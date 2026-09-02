/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { Store } from 'redux';
import { registerExploreStarterSuggestions } from './starter_suggestions';
import { ChatPluginSetup, StarterSuggestionsContext } from '../../chat/public';
import { RootState } from './application/utils/state_management/store';
import { QueryExecutionStatus } from './application/utils/state_management/types';

const DEFAULT_CARD = { id: 'default', icon: 'help', text: 'A default card' };

const makeContext = (): StarterSuggestionsContext => ({
  appId: 'explore/logs',
  pathname: '/app/explore/logs',
  defaults: [DEFAULT_CARD],
});

/** A store stand-in holding only the slice the provider reads. State is replaced, not mutated, so reselect recomputes. */
const makeStore = (
  status?: QueryExecutionStatus,
  {
    queryString = 'source=logs',
    error,
  }: { queryString?: string; error?: Record<string, unknown> } = {}
) => {
  const listeners: Array<() => void> = [];
  let state = {
    queryEditor: {
      overallQueryStatus: status ? { status, error } : undefined,
    },
    query: { query: queryString },
  };

  const store = {
    getState: () => state as unknown as RootState,
    subscribe: jest.fn((listener: () => void) => {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index >= 0) {
          listeners.splice(index, 1);
        }
      };
    }),
  };

  return {
    store: store as unknown as Store<RootState>,
    subscribeMock: store.subscribe,
    setStatus: (next: QueryExecutionStatus) => {
      state = { ...state, queryEditor: { overallQueryStatus: { status: next, error } } };
      listeners.forEach((listener) => listener());
    },
    notifyWithoutChange: () => listeners.forEach((listener) => listener()),
  };
};

describe('registerExploreStarterSuggestions', () => {
  let registerProvider: jest.Mock;
  let invalidate: jest.Mock;
  let unregister: jest.Mock;
  let chat: ChatPluginSetup;

  const getRegisteredProvider = () => registerProvider.mock.calls[0][0];

  beforeEach(() => {
    invalidate = jest.fn();
    unregister = jest.fn();
    registerProvider = jest.fn().mockReturnValue({ invalidate, unregister });
    chat = { starterSuggestions: { registerProvider } } as unknown as ChatPluginSetup;
  });

  it('registers one provider covering the base app and every flavor', () => {
    registerExploreStarterSuggestions(chat);

    expect(registerProvider).toHaveBeenCalledTimes(1);
    expect(getRegisteredProvider()).toEqual(
      expect.objectContaining({
        id: 'explore',
        appId: ['explore', 'explore/logs', 'explore/traces', 'explore/metrics'],
      })
    );
  });

  it('falls back to the defaults before a store is attached', () => {
    registerExploreStarterSuggestions(chat);

    expect(getRegisteredProvider().getSuggestions(makeContext())).toEqual([DEFAULT_CARD]);
  });

  it('falls back to the defaults once the store is detached again', () => {
    const suggestions = registerExploreStarterSuggestions(chat);
    suggestions.setStore(makeStore(QueryExecutionStatus.READY).store);

    suggestions.clearStore();

    expect(getRegisteredProvider().getSuggestions(makeContext())).toEqual([DEFAULT_CARD]);
  });

  describe('cards per query status', () => {
    it.each([
      [QueryExecutionStatus.ERROR, 'Fix this query error'],
      [QueryExecutionStatus.NO_RESULTS, 'Why did my query return no results?'],
      [QueryExecutionStatus.READY, 'Summarize these results'],
    ])('offers "%s" → "%s"', (status, expectedText) => {
      const suggestions = registerExploreStarterSuggestions(chat);
      suggestions.setStore(makeStore(status).store);

      const cards = getRegisteredProvider().getSuggestions(makeContext());

      expect(cards).toHaveLength(1);
      expect(cards[0].text).toBe(expectedText);
    });

    it('gives every card a distinct camelCase id so its test subj is stable', () => {
      const suggestions = registerExploreStarterSuggestions(chat);
      const ids = [
        QueryExecutionStatus.ERROR,
        QueryExecutionStatus.NO_RESULTS,
        QueryExecutionStatus.READY,
      ].map((status) => {
        suggestions.setStore(makeStore(status).store);
        return getRegisteredProvider().getSuggestions(makeContext())[0].id;
      });

      expect(ids).toEqual(['fixQueryError', 'explainNoResults', 'summarizeResults']);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it.each([[QueryExecutionStatus.UNINITIALIZED], [QueryExecutionStatus.LOADING]])(
      'keeps the defaults while %s',
      (status) => {
        const suggestions = registerExploreStarterSuggestions(chat);
        suggestions.setStore(makeStore(status).store);

        expect(getRegisteredProvider().getSuggestions(makeContext())).toEqual([DEFAULT_CARD]);
      }
    );

    it('puts the failing query and its reason into the error prompt', () => {
      const suggestions = registerExploreStarterSuggestions(chat);
      suggestions.setStore(
        makeStore(QueryExecutionStatus.ERROR, {
          queryString: 'source=logs | where bad',
          error: { message: { reason: 'SyntaxError' } },
        }).store
      );

      const [card] = getRegisteredProvider().getSuggestions(makeContext());

      expect(card.prompt).toContain('source=logs | where bad');
      expect(card.prompt).toContain('SyntaxError');
    });

    it('still offers a usable error prompt when the query text is empty', () => {
      const suggestions = registerExploreStarterSuggestions(chat);
      suggestions.setStore(makeStore(QueryExecutionStatus.ERROR, { queryString: '' }).store);

      const [card] = getRegisteredProvider().getSuggestions(makeContext());

      expect(card.prompt).toBe('My query failed. Help me understand the error and fix it.');
    });
  });

  describe('reacting to the Redux store', () => {
    it('invalidates when the query status changes', () => {
      const suggestions = registerExploreStarterSuggestions(chat);
      const { store, setStatus } = makeStore(QueryExecutionStatus.UNINITIALIZED);
      suggestions.setStore(store);

      setStatus(QueryExecutionStatus.ERROR);

      expect(invalidate).toHaveBeenCalledTimes(1);
    });

    it('ignores store updates that leave the status alone', () => {
      const suggestions = registerExploreStarterSuggestions(chat);
      const { store, notifyWithoutChange } = makeStore(QueryExecutionStatus.READY);
      suggestions.setStore(store);

      notifyWithoutChange();
      notifyWithoutChange();

      expect(invalidate).not.toHaveBeenCalled();
    });

    it('stops listening after the store is detached', () => {
      const suggestions = registerExploreStarterSuggestions(chat);
      const { store, setStatus } = makeStore(QueryExecutionStatus.UNINITIALIZED);
      suggestions.setStore(store);

      suggestions.clearStore();
      setStatus(QueryExecutionStatus.ERROR);

      expect(invalidate).not.toHaveBeenCalled();
    });
  });
});
