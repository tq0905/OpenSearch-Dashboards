/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { extractQueryError } from '../../../../../data/common';
import { ResultStatus, SearchData } from './use_search';

export interface QueryOutcome {
  status: ResultStatus;
  resultsCount?: number;
  error?: string;
}

export function readResultsCount(searchData: SearchData): number | undefined {
  if (searchData.status !== ResultStatus.READY && searchData.status !== ResultStatus.NO_RESULTS) {
    return undefined;
  }
  if (typeof searchData.hits === 'number' && searchData.hits > 0) {
    return searchData.hits;
  }
  return searchData.rows?.length ?? 0;
}

/**
 * Normalises a search result into "what happened to the query".
 */
export function readQueryOutcome(searchData: SearchData): QueryOutcome {
  const parseFailure = searchData.status === ResultStatus.NO_RESULTS && !!searchData.actualError;
  const resultsCount = parseFailure ? undefined : readResultsCount(searchData);
  return {
    status: parseFailure ? ResultStatus.ERROR : searchData.status,
    ...(typeof resultsCount === 'number' ? { resultsCount } : {}),
    ...(parseFailure
      ? { error: searchData.actualError }
      : searchData.status === ResultStatus.ERROR
        ? { error: extractQueryError(searchData.queryStatus?.body?.error) }
        : {}),
  };
}
