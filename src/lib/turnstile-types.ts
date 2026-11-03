export interface TurnstileApi {
  render: (container: HTMLElement, options: {
    sitekey: string;
    appearance?: 'always' | 'interaction-only' | 'execute';
    execution?: 'render' | 'execute';
    callback: (token: string) => void;
    'expired-callback': () => void;
    'error-callback': () => void;
  }) => string;
  execute: (widgetId: string) => void;
  reset: (widgetId?: string) => void;
}