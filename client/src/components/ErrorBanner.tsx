import { AlertTriangle, X } from 'lucide-react';

import type { ApiErrorCode, Lang } from '@asb/shared';

import { ApiCallError } from '../lib/api';
import { t } from '../lib/translations';

interface Props {
  error: unknown;
  lang: Lang;
  onDismiss?: () => void;
  onRetry?: () => void;
}

function codeToMessage(code: ApiErrorCode | undefined, lang: Lang): string {
  const ui = t(lang);
  switch (code) {
    case 'LLM_REQUIRED':
      return ui.errorLlmRequired;
    case 'LLM_CALL_FAILED':
      return ui.errorLlmCallFailed;
    case 'AI_PARSE':
    case 'AI_INVALID':
      return ui.errorAiInvalid;
    default:
      return ui.errorGeneric;
  }
}

/**
 * Structured error banner. Reads `code` off ApiCallError to pick localized copy,
 * falls back to message for non-API errors.
 */
export default function ErrorBanner({ error, lang, onDismiss, onRetry }: Props) {
  if (!error) return null;
  const ui = t(lang);

  let body: string;
  if (error instanceof ApiCallError) {
    body = codeToMessage(error.error.code, lang);
  } else if (error instanceof Error && error.name === 'TypeError') {
    // fetch() throws TypeError on network errors
    body = ui.errorNetwork;
  } else if (error instanceof Error) {
    body = error.message || ui.errorGeneric;
  } else {
    body = ui.errorGeneric;
  }

  return (
    <div
      role="alert"
      className="mt-4 flex items-start gap-3 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100"
    >
      <AlertTriangle size={18} className="mt-0.5 shrink-0" />
      <div className="flex-1">{body}</div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded-md bg-red-400/20 px-2 py-1 text-xs hover:bg-red-400/30"
        >
          {ui.retry}
        </button>
      )}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 text-red-200/70 hover:text-red-100"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
