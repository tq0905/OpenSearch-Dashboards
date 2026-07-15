/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback } from 'react';
import { EuiIcon, EuiLink } from '@elastic/eui';
import { i18n } from '@osd/i18n';
import { useOpenSearchDashboards } from '../../../../opensearch_dashboards_react/public';
import { ExploreServices } from '../../types';

const ASK_AI_NO_RESULTS_MESSAGE = `My query on this page returned no results. Please help me adjust it and run the corrected query on the page so I can see the data. Check the following in order: 1) Verify the fields I referenced actually exist. 2) Check whether the filter values are valid - a value I used may simply not exist in the data; try plausible alternative values or a broader condition. 3) If the fields and values both look correct, the time range is likely too narrow, so widen it.`;

const ASK_AI_ERROR_MESSAGE =
  'My query on this page failed to run with the following error: "{error}". Please review my query, fix it, and run the corrected query on the page so I can see the results.';

interface AskErrorButtonProps {
  error?: string;
}

export const AskErrorButton = ({ error }: AskErrorButtonProps) => {
  const {
    services: { core },
  } = useOpenSearchDashboards<ExploreServices>();

  const onAskAI = useCallback(() => {
    const message = error
      ? ASK_AI_ERROR_MESSAGE.replace('{error}', error)
      : ASK_AI_NO_RESULTS_MESSAGE;
    core.chat.sendMessageWithWindow(message, []).catch(() => {});
  }, [core, error]);

  if (!(core?.chat?.isAvailable?.() ?? false)) {
    return null;
  }

  return (
    <EuiLink onClick={onAskAI} data-test-subj="exploreAskErrorButton">
      <EuiIcon type="generate" size="m" />{' '}
      {i18n.translate('explore.askErrorButton.askAI', {
        defaultMessage: 'Ask AI for help',
      })}
    </EuiLink>
  );
};
