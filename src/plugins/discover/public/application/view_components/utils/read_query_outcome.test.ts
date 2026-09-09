/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { readQueryOutcome } from './read_query_outcome';
import { ResultStatus, SearchData } from './use_search';

const searchData = (overrides: Partial<SearchData>): SearchData => ({
  status: ResultStatus.READY,
  ...overrides,
});

const rows = (count: number) => new Array(count).fill({}) as SearchData['rows'];

describe('readQueryOutcome', () => {
  describe('result count', () => {
    it('uses hits.total when the strategy reports one', () => {
      expect(readQueryOutcome(searchData({ hits: 1204, rows: rows(500) }))).toMatchObject({
        resultsCount: 1204,
      });
    });

    it('falls back to the fetched rows when hits.total is 0', () => {
      // PPL responses carry no hits.total, so it arrives as 0 with rows present.
      expect(readQueryOutcome(searchData({ hits: 0, rows: rows(37) }))).toMatchObject({
        resultsCount: 37,
      });
    });

    it('falls back to the fetched rows when hits.total is absent', () => {
      expect(readQueryOutcome(searchData({ rows: rows(12) }))).toMatchObject({
        resultsCount: 12,
      });
    });

    it('reports zero when nothing came back at all', () => {
      expect(readQueryOutcome(searchData({ hits: 0, rows: [] }))).toMatchObject({
        resultsCount: 0,
      });
    });

    it('reports zero for a settled result with no rows field at all', () => {
      expect(readQueryOutcome(searchData({ hits: 0 }))).toMatchObject({ resultsCount: 0 });
    });

    it.each([[ResultStatus.LOADING], [ResultStatus.UNINITIALIZED], [ResultStatus.ERROR]])(
      'omits the count while the status is %s',
      (status) => {
        expect(readQueryOutcome(searchData({ status }))).not.toHaveProperty('resultsCount');
      }
    );

    it.each([[ResultStatus.LOADING], [ResultStatus.UNINITIALIZED], [ResultStatus.ERROR]])(
      'does not report rows left over from the previous fetch while %s',
      (status) => {
        // use_search spreads the previous value when it only flips status, so
        // the last fetch's rows can outlive the result they belong to.
        expect(
          readQueryOutcome(searchData({ status, hits: 12, rows: rows(37) }))
        ).not.toHaveProperty('resultsCount');
      }
    );

    it('reports no count for a query that never parsed', () => {
      expect(
        readQueryOutcome(
          searchData({ status: ResultStatus.NO_RESULTS, actualError: 'parse failed', rows: [] })
        )
      ).not.toHaveProperty('resultsCount');
    });
  });

  describe('status and error', () => {
    it('passes a plain status through', () => {
      expect(readQueryOutcome(searchData({ status: ResultStatus.LOADING })).status).toBe(
        ResultStatus.LOADING
      );
    });

    it('extracts the reason on error', () => {
      const outcome = readQueryOutcome(
        searchData({
          status: ResultStatus.ERROR,
          queryStatus: {
            body: { error: { message: { error: { reason: 'bad field', details: '' } } } },
          },
        })
      );

      expect(outcome).toMatchObject({ status: ResultStatus.ERROR, error: 'bad field' });
    });

    it('normalises a parse failure reported as no results into an error', () => {
      const outcome = readQueryOutcome(
        searchData({ status: ResultStatus.NO_RESULTS, actualError: 'parse failed', rows: [] })
      );

      expect(outcome).toMatchObject({ status: ResultStatus.ERROR, error: 'parse failed' });
    });

    it('leaves a genuine empty result alone', () => {
      const outcome = readQueryOutcome(
        searchData({ status: ResultStatus.NO_RESULTS, hits: 0, rows: [] })
      );

      expect(outcome).toMatchObject({ status: ResultStatus.NO_RESULTS, resultsCount: 0 });
      expect(outcome).not.toHaveProperty('error');
    });

    it('reports no error for a successful search', () => {
      expect(readQueryOutcome(searchData({ hits: 5, rows: rows(5) }))).not.toHaveProperty('error');
    });
  });
});
