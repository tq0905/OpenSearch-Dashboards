/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ChatPluginSetup,
  StarterSuggestionItem,
  StarterSuggestionsContext,
} from '../../chat/public';
import { ResultStatus } from './application/view_components/utils';
import { DISCOVER_HOST_APP_ID, DISCOVER_PAGE_CONTEXT_ID, PLUGIN_ID } from '../common';

interface DiscoverPageContextValue {
  query?: {
    query?: string;
    language?: string;
    languageDisplayName?: string;
    status?: ResultStatus;
    resultsCount?: number;
    error?: string;
  };
}

/**
 * `contexts` carries every agent-visible entry — Discover's own plus whatever
 * else is publishing into the store — so pick ours out by the id it registers
 * under rather than guessing a position.
 */
const readPageContext = (context: StarterSuggestionsContext): DiscoverPageContextValue => {
  return context.contexts?.find((entry) => entry.id === DISCOVER_PAGE_CONTEXT_ID)?.value ?? {};
};

const describeResultCount = (count?: number) =>
  typeof count === 'number' ? `these ${count.toLocaleString()} results` : 'these results';

export function registerDiscoverStarterSuggestions(chat: ChatPluginSetup) {
  return chat.starterSuggestions.registerProvider({
    id: PLUGIN_ID,
    // The 'discover' app only redirects; the UI is rendered by data-explorer
    appId: DISCOVER_HOST_APP_ID,
    getSuggestions: (context: StarterSuggestionsContext): StarterSuggestionItem[] => {
      const query = readPageContext(context).query;
      const queryText = query?.query ?? '';

      switch (query?.status) {
        case ResultStatus.ERROR:
          return [
            {
              id: 'fixQueryError',
              icon: 'alert',
              iconColor: 'danger',
              text: 'Fix this query error',
              prompt: queryText
                ? `My query "${queryText}" failed with error: "${
                    query.error ?? 'unknown error'
                  }". Help me fix it.`
                : 'My query failed. Help me understand the error and fix it.',
            },
          ];

        case ResultStatus.NO_RESULTS:
          return [
            {
              id: 'explainNoResults',
              icon: 'help',
              text: 'Why did my query return no results?',
              prompt: queryText
                ? `My query "${queryText}" returned no results. Help me understand why.`
                : 'My query returned no results. Help me understand why.',
            },
          ];

        case ResultStatus.READY:
          return [
            {
              id: 'summarizeResults',
              icon: 'visBarVertical',
              text: `Summarize ${describeResultCount(query.resultsCount)}`,
              prompt: queryText
                ? `Summarize the results for query: ${queryText}`
                : 'Summarize the current query results.',
            },
          ];

        default:
          return context.defaults;
      }
    },
  });
}
