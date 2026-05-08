// Utility to create page URLs for Next.js routing
export function createPageUrl(pageName: string): string {
  // Handle special cases where kebab conversion doesn't match folder names
  const specialCases: Record<string, string> = {
    'AdminLogin': '/admin-login',
    'RoadAssistApp': '/road-assist-app',
    'DriverApp': '/driver-app',
    'Notificaciones': '/notificaciones',
    'PaymentMethods': '/payment-methods',
    'SOSAlerts': '/sos-alerts',
    'RoadAssist': '/road-assist-app',
    'RoadAssistAdmin': '/road-assist-app',
  };

  if (specialCases[pageName]) return specialCases[pageName];

  // Convert PascalCase to kebab-case
  const kebab = pageName
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/\s+/g, '-')
    .toLowerCase();

  return '/' + kebab.replace(/^-+/, '');
}