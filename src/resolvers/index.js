import Resolver from '@forge/resolver';

const resolver = new Resolver();

resolver.define('runAudit', async () => {
  const severities = [
    { level: 'high', message: 'Critical policy violation detected.' },
    { level: 'medium', message: 'Potential risk requiring review.' },
    { level: 'low', message: 'No issues found during the scan.' }
  ];

  const flags = Array.from({ length: 3 }).map((_, index) => {
    const choice = severities[Math.floor(Math.random() * severities.length)];
    return {
      id: `flag-${index + 1}`,
      severity: choice.level,
      message: choice.message
    };
  });

  return { flags };
});

export const handler = resolver.getDefinitions();
export default resolver;
