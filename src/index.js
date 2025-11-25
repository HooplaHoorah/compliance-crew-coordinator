// src/index.js
import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';
import { listTemplates, evaluateTemplate } from './rules';

const resolver = new Resolver();

// --------- Helpers ---------

function getIssueKeyFromContext(context) {
  if (!context) return undefined;

  // Common shapes for jira:issuePanel
  if (context.extension?.issue?.key) {
    return context.extension.issue.key;
  }

  // Fallbacks for other module shapes / future-proofing
  if (context.issue?.key) {
    return context.issue.key;
  }
  if (context.extensionContext?.issueKey) {
    return context.extensionContext.issueKey;
  }

  return undefined;
}

// --------- Resolvers ---------

// Simple health-check
resolver.define('getText', () => {
  return 'Compliance Crew Coordinator is online ✅';
});

// List templates for the frontend
resolver.define('getTemplates', ({ context }) => {
  const templates = listTemplates();

  // Default: first template, if nothing smarter is possible
  let recommendedTemplateId = templates[0]?.id || null;

  // Use existing helper to get issue key from context
  const issueKey = getIssueKeyFromContext(context);

  if (typeof issueKey === 'string' && issueKey.includes('-')) {
    const projectKey = issueKey.split('-')[0].toUpperCase();

    if (projectKey) {
      const isWilliamsProject = ['WR', 'WRF1', 'RACE'].includes(projectKey);
      const isSprintyProject = ['KAN', 'BOARD', 'SCRUM'].includes(projectKey);

      if (isWilliamsProject) {
        const williamsTemplate =
          templates.find((t) =>
            (t.id || '').toLowerCase().includes('williams'),
          ) || templates[0];
        recommendedTemplateId = williamsTemplate.id;
      } else if (isSprintyProject) {
        const sprintTemplate =
          templates.find((t) =>
            (t.id || '').toLowerCase().includes('sprint'),
          ) || templates[0];
        recommendedTemplateId = sprintTemplate.id;
      }
    }
  }

  return {
    templates,
    recommendedTemplateId,
  };
});

// Run an audit on the current issue using a chosen template
resolver.define('runAudit', async (req) => {
  const { payload, context } = req;

  try {
    const templates = listTemplates();
    const templateId =
      payload && payload.templateId ? payload.templateId : templates[0].id;
    const template = templates.find((t) => t.id === templateId);

    if (!template) {
      return {
        error: true,
        errorMessage: `Unknown template: ${templateId}`,
      };
    }

    const issueKey = getIssueKeyFromContext(context);
    if (!issueKey) {
      return {
        error: true,
        errorMessage:
          'Could not determine issue key from context. Try refreshing the page; if it persists, check the jira:issuePanel module wiring.',
        debug: { context },
      };
    }

    const fieldsToFetch = [
      'summary',
      'description',
      'assignee',
      'labels',
      'priority',
      'duedate',
      'issuetype',
      'project',
    ];

    const fieldsParam = encodeURIComponent(fieldsToFetch.join(','));

    const response = await api
      .asUser()
      .requestJira(
        route`/rest/api/3/issue/${issueKey}?fields=${fieldsParam}`,
      );

    if (!response.ok) {
      const text = await response.text();
      console.error('Error fetching issue from Jira', response.status, text);
      return {
        error: true,
        errorMessage: `Failed to fetch issue data from Jira (status ${response.status}).`,
        debug: { status: response.status, body: text },
      };
    }

    const issueData = await response.json();
    const fields = issueData.fields || {};

    const auditRun = evaluateTemplate(template, fields);

    return {
      issueKey,
      ...auditRun,
    };
  } catch (err) {
    console.error('runAudit unexpected error', err);
    return {
      error: true,
      errorMessage: 'Unexpected error in runAudit. See developer console/logs.',
      debug: { message: err.message, stack: err.stack },
    };
  }
});
resolver.define('draftBetterDescription', async (req) => {
  const { payload, context } = req;

  try {
    const templates = listTemplates();
    const templateId = payload && payload.templateId ? payload.templateId : templates[0]?.id;
    const template =
      templates.find((t) => t.id === templateId) || templates[0] || null;

    const issueKey = getIssueKeyFromContext(context);
    if (!issueKey) {
      return {
        error: true,
        errorMessage:
          'Could not determine issue key from context for AI helper.',
        debug: { context },
      };
    }

    const fieldsToFetch = ['summary', 'description', 'labels', 'priority'];
    const fieldsParam = encodeURIComponent(fieldsToFetch.join(','));

    const response = await api
      .asUser()
      .requestJira(
        route`/rest/api/3/issue/${issueKey}?fields=${fieldsParam}`,
      );

    if (!response.ok) {
      const text = await response.text();
      console.error(
        'draftBetterDescription Jira fetch error',
        response.status,
        text,
      );
      return {
        error: true,
        errorMessage: `AI helper could not read this issue from Jira (status ${response.status}).`,
        debug: { status: response.status, body: text },
      };
    }

    const issueData = await response.json();
    const fields = issueData.fields || {};
    const rawSummary = fields.summary || '';
    const rawDescription = fields.description;

    let descriptionText = '';
    if (typeof rawDescription === 'string') {
      descriptionText = rawDescription;
    } else if (rawDescription && typeof rawDescription === 'object') {
      // Very lightweight stringify – in a real app, we would parse ADF to plain text
      try {
        descriptionText = JSON.stringify(rawDescription);
      } catch (e) {
        descriptionText = '';
      }
    }

    const trimmedSummary = rawSummary.trim();
    const trimmedDesc = descriptionText.trim();

    const missingSummary = trimmedSummary.length === 0;
    const veryShortDesc = trimmedDesc.length < 80;

    const suggestions = [];

    if (missingSummary) {
      suggestions.push(
        'Add a short, user-facing summary that describes what is changing and for whom.',
      );
    } else {
      suggestions.push(
        'Tighten the summary so it focuses on the user impact and outcome, not just the implementation detail.',
      );
    }

    if (veryShortDesc) {
      suggestions.push(
        'Expand the description with sections for Context, Change, Acceptance criteria, and Test notes.',
      );
    } else {
      suggestions.push(
        'Restructure the description into clearly labeled sections (Context, Change, Risk, Rollback, Validation).',
      );
    }

    if (template && (template.id || '').toLowerCase().includes('williams')) {
      suggestions.push(
        'Call out the release type (prod / pre-prod / low-risk) and who validates the change on the Williams side.',
      );
    }

    return {
      issueKey,
      templateId: template ? template.id : null,
      templateName: template ? template.name : null,
      summary: rawSummary,
      descriptionPreview: trimmedDesc.slice(0, 240),
      suggestions,
      note:
        'Demo-only AI stub: in production this call would go to an LLM with your team-specific prompt and rules.',
    };
  } catch (err) {
    console.error('draftBetterDescription unexpected error', err);
    return {
      error: true,
      errorMessage:
        'Unexpected error in draftBetterDescription. See developer console/logs.',
      debug: { message: err.message, stack: err.stack },
    };
  }
});


export const handler = resolver.getDefinitions();
