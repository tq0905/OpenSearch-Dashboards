/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { EuiButton } from '@elastic/eui';
import { i18n } from '@osd/i18n';
import { ChatServiceStart } from '../../../../../core/public';
import { AgentError, extractAgentErrorDetail, formatError } from './utils/error';

interface AskT2pplErrorButtonProps {
  chatService: ChatServiceStart;
  error: Error;
  question: string;
}

// Build the message sent to chat from the failed T2PPL generation, surfacing the real cause.
const buildAskAiMessage = (error: Error, question: string): string => {
  const formattedError = formatError(error);
  let reason = formattedError.message;
  let detail = '';
  if (formattedError instanceof AgentError) {
    const {
      error: { error: agentError },
    } = formattedError;
    reason = agentError.reason;
    detail = extractAgentErrorDetail(agentError.details);
  }
  return `The AI query assist failed to generate a query${
    question ? ` from my question "${question}"` : ''
  }. It returned with the error "Reason: ${reason}${
    detail ? `; Details: ${detail}` : ''
  }"\n\nPlease explain what went wrong.`;
};

/**
 * An "Ask AI for help" button meant to be attached to an error toast through the ErrorToast
 * `extraAction` slot, so the user can escalate a failed T2PPL (text-to-PPL) generation to chat.
 */
const AskT2pplErrorButton: React.FC<AskT2pplErrorButtonProps> = ({
  chatService,
  error,
  question,
}) => {
  const message = buildAskAiMessage(error, question);
  return (
    <EuiButton
      size="s"
      color="danger"
      style={{ marginLeft: 8 }}
      onClick={() => chatService.sendMessageWithWindow(message, []).catch(() => {})}
      data-test-subj="exploreQueryAssistAskAIForHelp"
    >
      {i18n.translate('explore.queryPanel.askAIForHelp', {
        defaultMessage: 'Ask AI for help',
      })}
    </EuiButton>
  );
};

export const createAskT2pplErrorButton = (props: AskT2pplErrorButtonProps) => (
  <AskT2pplErrorButton {...props} />
);
