/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { useSelector } from 'react-redux';
import { useOpenSearchDashboards } from '../../../../opensearch_dashboards_react/public';
import { ExploreServices } from '../../types';
import {
  selectLastExecutedPrompt,
  selectLastExecutedTranslatedQuery,
} from '../../application/utils/state_management/selectors';

const NOOP_DYNAMIC_CONTEXT_HOOK = (_options?: any): string => '';

/**
 * Registers the original natural language question and the query generated from it as
 * assistant context whenever a question has been asked, so the AI assistant knows the
 * query originated from a natural language prompt.
 */
export const useQueryAssistContext = () => {
  const { services } = useOpenSearchDashboards<ExploreServices>();
  const useDynamicContext =
    services.contextProvider?.hooks?.useDynamicContext ?? NOOP_DYNAMIC_CONTEXT_HOOK;

  const lastExecutedPrompt = useSelector(selectLastExecutedPrompt);
  const lastExecutedTranslatedQuery = useSelector(selectLastExecutedTranslatedQuery);

  const naturalLanguageContextActive = !!lastExecutedPrompt;

  useDynamicContext(
    naturalLanguageContextActive
      ? {
          id: 'query-assist-natural-language-prompt',
          description:
            'The natural language question the user asked and the query generated from it with a standalone AI assist',
          value: {
            naturalLanguageQuestion: lastExecutedPrompt,
            generatedQuery: lastExecutedTranslatedQuery,
          },
          label: 'Natural language question',
          categories: ['page', 'dynamic'],
        }
      : null
  );
};
