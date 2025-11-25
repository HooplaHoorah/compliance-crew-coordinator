// src/templates.js
// V1 template catalog for Compliance Crew Coordinator

export const COMPLIANCE_TEMPLATES = [
  {
    id: 'sprint-hygiene-v1',
    name: 'Sprint hygiene – basics',
    description:
      'Lightweight checks that stories and tasks have the basics filled in before sprint start.',
    scope: 'jiraIssue',
    appliesTo: {
      projectKeys: ['*'],
      issueTypes: ['Story', 'Task', 'Bug'],
    },
    checks: [
      {
        id: 'summary-present',
        label: 'Summary is present',
        description: 'Issue must have a non-empty summary.',
        category: 'metadata',
        severity: 'critical',
        fieldKey: 'summary',
        ruleType: 'requiredField',
        ruleConfig: {},
        hints: ['Fill in a concise, user-facing summary.'],
      },
      {
        id: 'description-min-length',
        label: 'Description has enough detail',
        description: 'Description should be at least 40 characters.',
        category: 'metadata',
        severity: 'warning',
        fieldKey: 'description',
        ruleType: 'textMinLength',
        ruleConfig: { minLength: 40 },
        hints: ['Add acceptance criteria, context, and test notes.'],
      },
      {
        id: 'assignee-present',
        label: 'Assignee is set',
        description: 'Issue should be assigned before sprint start.',
        category: 'ownership',
        severity: 'warning',
        fieldKey: 'assignee',
        ruleType: 'requiredField',
        ruleConfig: {},
        hints: ['Assign an owner or set a placeholder assignee.'],
      },
      {
        id: 'labels-present',
        label: 'At least one label',
        description: 'Issue should have at least one label.',
        category: 'classification',
        severity: 'info',
        fieldKey: 'labels',
        ruleType: 'requiredLabel',
        ruleConfig: { anyOf: ['*'] }, // "*" = at least one label
        hints: ['Add a team, component, or regulation label.'],
      },
      {
        id: 'priority-in-set',
        label: 'Priority is one of allowed values',
        description:
          'Priority should be set to Blocker, Critical, Major, Minor, or Trivial.',
        category: 'metadata',
        severity: 'info',
        fieldKey: 'priority',
        ruleType: 'fieldInSet',
        ruleConfig: {
          allowedValues: ['Blocker', 'Critical', 'Major', 'Minor', 'Trivial'],
        },
        hints: ['Use a priority consistent with your team workflow.'],
      },
    ],
  },
  {
    id: 'williams-release-readiness-v1',
    name: 'Williams Racing – release readiness',
    description:
      'Makes sure a change is safe to “go racing” – checks labels and description for rollback and test plans.',
    scope: 'jiraIssue',
    appliesTo: {
      projectKeys: ['WR', 'WRF1'], // adjust to your actual project keys
      issueTypes: ['Story', 'Task', 'Bug', 'Change'],
    },
    checks: [
      {
        id: 'release-label',
        label: 'Release / deployment label',
        description: 'Issues targeting production should be tagged appropriately.',
        category: 'classification',
        severity: 'critical',
        fieldKey: 'labels',
        ruleType: 'requiredLabel',
        ruleConfig: { anyOf: ['release', 'prod-release', 'production'] },
        hints: ['Add a release label such as release, prod-release, or production.'],
      },
      {
        id: 'risk-label',
        label: 'Risk label present',
        description:
          'Helps downstream tooling and dashboards see risk hotspots.',
        category: 'risk',
        severity: 'warning',
        fieldKey: 'labels',
        ruleType: 'requiredLabel',
        ruleConfig: { anyOf: ['risk', 'risk-accepted', 'safety-critical'] },
        hints: ['If this change is low-risk, explicitly label it as such.'],
      },
      {
        id: 'rollback-plan',
        label: 'Rollback / back-out plan included',
        description:
          'Description should mention how to recover if the change misbehaves.',
        category: 'runbook',
        severity: 'critical',
        fieldKey: 'description',
        ruleType: 'textContains',
        ruleConfig: {
          phrases: ['rollback', 'roll back', 'backout', 'back-out'],
          matchMode: 'any',
        },
        hints: ['Describe how to roll back, including time window and who drives it.'],
      },
      {
        id: 'test-plan',
        label: 'Test plan described',
        description:
          'Description should mention how the change will be validated.',
        category: 'testing',
        severity: 'warning',
        fieldKey: 'description',
        ruleType: 'textContains',
        ruleConfig: {
          phrases: ['test plan', 'validation', 'acceptance criteria'],
          matchMode: 'any',
        },
        hints: ['Describe how you’ll validate the change and what “good” looks like.'],
      },
    ],
  },
  {
    id: 'williams-incident-review-v1',
    name: 'Williams Racing – incident / anomaly review',
    description:
      'Helps make sure production or trackside incidents have a structured write-up for “lessons learned” and safety dashboards.',
    scope: 'jiraIssue',
    appliesTo: {
      projectKeys: ['WR', 'WRF1'], // adjust to your actual project keys
      issueTypes: ['Story', 'Task', 'Bug'],
    },
    checks: [
      {
        id: 'incident-label',
        label: 'Incident / postmortem label present',
        description:
          'Incident or anomaly follow-ups should be clearly tagged so they turn up in reports.',
        category: 'classification',
        severity: 'critical',
        fieldKey: 'labels',
        ruleType: 'requiredLabel',
        ruleConfig: { anyOf: ['incident', 'postmortem', 'incident-review'] },
        hints: ['Add a label such as incident, postmortem, or incident-review.'],
      },
      {
        id: 'root-cause-described',
        label: 'Root cause and impact described',
        description:
          'Description should mention suspected root cause, blast radius, and impact.',
        category: 'analysis',
        severity: 'critical',
        fieldKey: 'description',
        ruleType: 'textContains',
        ruleConfig: {
          phrases: ['root cause', 'impact', 'blast radius', 'contributing factor'],
          matchMode: 'any',
        },
        hints: [
          'Capture what happened, why it happened, and how bad it was – root cause, impact, and contributing factors.',
        ],
      },
      {
        id: 'mitigation-and-followups',
        label: 'Mitigation and follow-ups captured',
        description:
          'Description should outline immediate mitigations and longer-term follow-ups.',
        category: 'mitigation',
        severity: 'warning',
        fieldKey: 'description',
        ruleType: 'textContains',
        ruleConfig: {
          phrases: ['mitigation', 'temporary fix', 'follow-up', 'action item', 'prevent recurrence'],
          matchMode: 'any',
        },
        hints: [
          'List mitigations taken, remaining risks, and the actions that will prevent a recurrence.',
        ],
      },
      {
        id: 'timeline-described',
        label: 'Timeline captured',
        description:
          'Timeline of key events (when detected, when mitigated, when fully resolved) should be present.',
        category: 'analysis',
        severity: 'warning',
        fieldKey: 'description',
        ruleType: 'textContains',
        ruleConfig: {
          phrases: ['timeline', 'T0', 'T+'],
          matchMode: 'any',
        },
        hints: ['Include a simple timeline of events from first detection to full resolution.'],
      },
    ],
  },
];

export function listTemplates() {
  return COMPLIANCE_TEMPLATES;
}

export function getTemplateById(id) {
  return COMPLIANCE_TEMPLATES.find((t) => t.id === id) || null;
}
