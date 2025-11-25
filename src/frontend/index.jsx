// src/frontend/index.jsx
import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Text,
  Heading,
  Button,
  Stack,
  Inline,
} from '@forge/react';
import { invoke } from '@forge/bridge';

const App = () => {
  const [backendStatus, setBackendStatus] = useState(null);

  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [running, setRunning] = useState(false);
  const [audit, setAudit] = useState(null);
  const [error, setError] = useState(null);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  // Health check
  useEffect(() => {
    invoke('getText', { example: 'ping' })
      .then((msg) => setBackendStatus(msg))
      .catch((err) => {
        console.error('getText failed', err);
        setBackendStatus('Error talking to backend');
      });
  }, []);

// Load templates on mount
useEffect(() => {
  const load = async () => {
    try {
      const data = await invoke('getTemplates');

      // Support both the old shape (array) and new shape ({ templates, recommendedTemplateId })
      const templatesFromBackend = Array.isArray(data)
        ? data
        : data?.templates || [];
      const recommendedTemplateId =
        !Array.isArray(data) && data?.recommendedTemplateId
          ? data.recommendedTemplateId
          : null;

      setTemplates(templatesFromBackend);

      if (templatesFromBackend.length > 0) {
        const fallbackId = templatesFromBackend[0].id;
        const idToUse =
          recommendedTemplateId &&
          templatesFromBackend.some((t) => t.id === recommendedTemplateId)
            ? recommendedTemplateId
            : fallbackId;

        setSelectedTemplateId(idToUse);
      }
    } catch (e) {
      console.error(e);
      setError('Failed to load compliance templates.');
    } finally {
      setLoadingTemplates(false);
    }
  };

  load();
}, []);


  const selectedTemplate =
    templates.find((t) => t.id === selectedTemplateId) || null;

  const runAudit = async () => {
    if (!selectedTemplateId) {
      return;
    }
    setRunning(true);
    setError(null);
    setAudit(null);
    setAiError(null);
    setAiSuggestion(null);
    try {
      const result = await invoke('runAudit', {
        templateId: selectedTemplateId,
      });

      if (result && result.error) {
        console.error('runAudit backend error', result.debug || result);
        setError(
          result.errorMessage || 'Compliance engine reported an error.',
        );
        setAudit(null);
      } else {
        setAudit(result);
      }
    } catch (e) {
      console.error(e);
      setError('Failed to run compliance audit (frontend invoke error).');
      setAudit(null);
    } finally {
      setRunning(false);
    }
  };

const runAiStub = async () => {
  if (!selectedTemplateId) {
    return;
  }
  setAiLoading(true);
  setAiError(null);

  try {
    const result = await invoke('draftBetterDescription', {
      templateId: selectedTemplateId,
    });

    if (result && result.error) {
      console.error(
        'draftBetterDescription backend error',
        result.debug || result,
      );
      setAiError(
        result.errorMessage || 'AI helper (stub) reported an error.',
      );
      setAiSuggestion(null);
    } else {
      setAiSuggestion(result);
    }
  } catch (e) {
    console.error(e);
    setAiError('Failed to call AI helper (stub).');
    setAiSuggestion(null);
  } finally {
    setAiLoading(false);
  }
};


  const renderStatusEmoji = (status, severity) => {
    if (status === 'not-applicable') {
      return '⚪️';
    }
    if (status === 'pass') {
      return '🟢';
    }
    const sev = (severity || '').toLowerCase();
    if (sev === 'critical' || sev === 'high') {
      return '🔴';
    }
    if (sev === 'warning' || sev === 'medium') {
      return '🟡';
    }
    return '🟠';
  };

  const summarizeFailures = (results) => {
    let critical = 0;
    let warning = 0;
    let other = 0;

    (results || []).forEach((r) => {
      if (r.status !== 'fail') return;
      const sev = (r.severity || '').toLowerCase();
      if (sev === 'critical' || sev === 'high') critical += 1;
      else if (sev === 'warning' || sev === 'medium') warning += 1;
      else other += 1;
    });

    return { critical, warning, other };
  };

  const formatRunAt = (runAt) => {
    if (!runAt) return '';
    try {
      const d = new Date(runAt);
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleString();
    } catch (e) {
      return '';
    }
  };

  const renderDecisionLine = (overallStatus, results) => {
    const { critical, warning, other } = summarizeFailures(results);
    const total = critical + warning + other;

    if (overallStatus === 'pass') {
      return 'GO ✅ – all checks passed. Ready to roll. 🏁';
    }

    if (overallStatus === 'mixed') {
      // no critical fails, at least one warning
      return `CAUTION ⚠️ – ${warning + other} warning check${
        warning + other === 1 ? '' : 's'
      } failing.`;
    }

    if (overallStatus === 'fail') {
      const parts = [];
      if (critical) {
        parts.push(
          `${critical} critical check${critical === 1 ? '' : 's'}`,
        );
      }
      if (warning) {
        parts.push(
          `${warning} warning check${warning === 1 ? '' : 's'}`,
        );
      }
      if (other) {
        parts.push(
          `${other} other check${other === 1 ? '' : 's'}`,
        );
      }

      const summary = parts.length ? parts.join(', ') : 'failing checks';
      return `NO-GO 🚫 – ${summary}.`;
    }

    return overallStatus || '';
  };

  const renderSummaryLine = (audit) => {
    if (!audit || !Array.isArray(audit.results)) return '';
    const { critical, warning, other } = summarizeFailures(audit.results);
    const total = audit.results.length;
    const failingTotal = critical + warning + other;
    if (total === 0) return '';
    if (failingTotal === 0) {
      return `${total} checks evaluated; all passing.`;
    }
    return `${total} checks evaluated; ${failingTotal} failing (${critical} critical, ${warning} warning, ${other} other).`;
  };

const buildFixList = (audit, selectedTemplate) => {
  if (!audit || !selectedTemplate) return [];

  const results = Array.isArray(audit?.results) ? audit.results : [];
  if (results.length === 0) return [];

  // Only treat hard fails as "fix-list" items for now
  const failing = results.filter((r) => r.status === 'fail');
  if (failing.length === 0) return [];

  const checksById = new Map(
    (selectedTemplate.checks || []).map((c) => [c.id, c]),
  );

  const items = failing
    .map((r) => {
      const check = checksById.get(r.checkId);
      if (!check) return null;

      if (Array.isArray(check.hints) && check.hints.length > 0) {
        return check.hints[0];
      }

      return check.label;
    })
    .filter(Boolean);

  // De-duplicate while preserving order
  return Array.from(new Set(items));
};


  const failingResults =
    audit?.results?.filter((r) => r.status !== 'pass') || [];
  const fixList = buildFixList(audit, selectedTemplate);


  return (
    <Stack space="medium">
      {/* Top status */}
      <Stack space="none">
        <Text>Compliance Crew Coordinator is online 🟢</Text>
        <Text>{backendStatus || 'Pinging backend…'}</Text>
      </Stack>

      {/* Template selection + run button */}
      {loadingTemplates && <Text>Loading templates…</Text>}

      {!loadingTemplates && templates.length === 0 && (
        <Text>⚠️ No compliance templates defined.</Text>
      )}

      {!loadingTemplates && templates.length > 0 && (
        <Stack space="small">
          <Heading size="small">Templates</Heading>
          <Text>
            Active template:{' '}
            {selectedTemplate ? selectedTemplate.name : '(none selected)'}
          </Text>

          <Inline space="small">
            {templates.map((t) => (
              <Button
                key={t.id}
                appearance={
                  t.id === selectedTemplateId ? 'primary' : 'subtle'
                }
                onClick={() => setSelectedTemplateId(t.id)}
              >
                {t.name}
              </Button>
            ))}
          </Inline>

          {selectedTemplate && <Text>{selectedTemplate.description}</Text>}
          <Inline space="small">
            <Button
              appearance="primary"
              isDisabled={!selectedTemplateId}
              isLoading={running}
              onClick={runAudit}
            >
              {audit ? 'Re-run compliance audit' : 'Run compliance audit'}
            </Button>

            <Button
              appearance="subtle"
              isDisabled={!selectedTemplateId}
              isLoading={aiLoading}
              onClick={runAiStub}
            >
              {aiLoading ? 'Asking AI helper…' : 'AI draft (stub)'}
            </Button>
          </Inline>
        </Stack>
      )}

      {error && <Text>⚠️ {error}</Text>}

      {/* Audit results */}
      {audit && selectedTemplate && (
        <Stack space="small">
          <Heading size="small">Latest audit</Heading>

          <Text>{renderDecisionLine(audit.overallStatus, audit.results)}</Text>

          <Text>{renderSummaryLine(audit)}</Text>

          <Text>
            Template {selectedTemplate.name} on issue {audit.issueKey}
            {audit.runAt ? ` — last run ${formatRunAt(audit.runAt)}` : ''}.
          </Text>
{fixList.length > 0 && (
  <Stack space="xsmall">
    <Heading size="xsmall">Fix list</Heading>
    {fixList.map((item, idx) => (
      <Text key={idx}>• {item}</Text>
    ))}
  </Stack>
)}


          {aiError && (
            <Text>⚠️ {aiError}</Text>
          )}

          {aiSuggestion && !aiError && (
            <Stack space="xsmall">
              <Heading size="xsmall">AI helper (stub)</Heading>
              {aiSuggestion.note && <Text>{aiSuggestion.note}</Text>}
              {Array.isArray(aiSuggestion.suggestions) &&
                aiSuggestion.suggestions.length > 0 && (
                  <Stack space="none">
                    {aiSuggestion.suggestions.map((line, idx) => (
                      <Text key={idx}>• {line}</Text>
                    ))}
                  </Stack>
                )}
            </Stack>
          )}
          {failingResults.length === 0 && (
            <Text>🎉 No failing checks. You&apos;re clear to proceed.</Text>
          )}

          {failingResults.length > 0 && (
            <Stack space="none">
              {failingResults.map((r) => {
                const check = selectedTemplate.checks.find(
                  (c) => c.id === r.checkId,
                );
                if (!check) {
                  return null;
                }
                return (
                  <Stack key={r.checkId} space="none">
                    <Text>
                      {renderStatusEmoji(r.status, r.severity)} {check.label} —{' '}
                      {r.details}
                    </Text>
                    {check.hints && check.hints.length > 0 && (
                      <Text>
                        Hint:{' '}
                        {check.hints.join(' ')}
                      </Text>
                    )}
                  </Stack>
                );
              })}
            </Stack>
          )}
        </Stack>
      )}
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
