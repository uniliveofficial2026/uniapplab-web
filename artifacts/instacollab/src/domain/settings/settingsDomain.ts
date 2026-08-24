import type { SettingsViewModel } from '../../presentation/view-models/types';

/** App settings are AS (`user_app_state.app_settings`). Locale catalogs are never stored there. */
export function toSettingsViewModel(input: {
  locale: string;
  notificationsEnabled?: boolean;
  theme?: string;
}): SettingsViewModel {
  return {
    locale: input.locale || 'en',
    notificationsEnabled: Boolean(input.notificationsEnabled),
    theme: String(input.theme || 'dark'),
    status: 'ready',
  };
}
