// src/rules.js
// Core rule engine for Compliance Crew Coordinator

import { listTemplates, getTemplateById } from './templates';

function getFieldValue(fields, fieldKey) {
  if (!fields || !fieldKey) return undefined;
  return Object.prototype.hasOwnProperty.call(fields, fieldKey)
    ? fields[fieldKey]
    : undefined;
}

function isEmptyValue(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function normalizeScalar(value) {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? normalizeScalar(value[0]) : undefined;
  }
  if (typeof value === 'object') {
    if (typeof value.name === 'string') return value.name;
    if (typeof value.key === 'string') return value.key;
  }
  return undefined;
}


function coerceText(value) {
  if (value === null || value === undefined) return '';

  if (typeof value === 'string') {
    return value;
  }

  // Handle Jira rich-text / ADF objects (ADF blocks, nested nodes, etc.)
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (e) {
      return '';
    }
  }

  return String(value);
}

// ---- Individual rule evaluators ----


function evalRequiredField(check, fields) {
  const value = getFieldValue(fields, check.fieldKey);
  if (isEmptyValue(value)) {
    return {
      checkId: check.id,
      status: 'fail',
      severity: check.severity,
      details: `Field "${check.fieldKey}" is empty or missing.`,
    };
  }

  return {
    checkId: check.id,
    status: 'pass',
    severity: check.severity,
    details: 'Field is present.',
  };
}


function evalTextMinLength(check, fields) {
  const value = getFieldValue(fields, check.fieldKey);
  const minLength =
    check.ruleConfig && typeof check.ruleConfig.minLength === 'number'
      ? check.ruleConfig.minLength
      : 1;

  const text = coerceText(value).trim();
  const length = text.length;

  if (length >= minLength) {
    return {
      checkId: check.id,
      status: 'pass',
      severity: check.severity,
      details: `Length is ${length}, minimum is ${minLength}.`,
    };
  }

  return {
    checkId: check.id,
    status: 'fail',
    severity: check.severity,
    details: `Length is ${length}, minimum is ${minLength}.`,
  };
}

  return {
    checkId: check.id,
    status: 'fail',
    severity: check.severity,
    details: `Length is ${length}, minimum is ${minLength}.`,
  };
}

function evalRequiredLabel(check, fields) {
  const value = getFieldValue(fields, check.fieldKey);
  const labels = Array.isArray(value) ? value : [];
  const cfg = check.ruleConfig || {};
  const anyOf = Array.isArray(cfg.anyOf) ? cfg.anyOf : [];

  // Special case: ["*"] means "at least one label"
  if (anyOf.length === 1 && anyOf[0] === '*') {
    if (labels.length > 0) {
      return {
        checkId: check.id,
        status: 'pass',
        severity: check.severity,
        details: `Issue has ${labels.length} label(s).`,
      };
    }
    return {
      checkId: check.id,
      status: 'fail',
      severity: check.severity,
      details: 'Issue has no labels.',
    };
  }

  const present = anyOf.filter((l) => labels.includes(l));

  if (present.length > 0) {
    return {
      checkId: check.id,
      status: 'pass',
      severity: check.severity,
      details: `Matched label(s): ${present.join(', ')}.`,
    };
  }

  return {
    checkId: check.id,
    status: 'fail',
    severity: check.severity,
    details: `Missing any of required labels: ${anyOf.join(', ')}.`,
  };
}

function evalFieldInSet(check, fields) {
  const value = getFieldValue(fields, check.fieldKey);
  const normalized = normalizeScalar(value);
  const allowedValues =
    (check.ruleConfig && check.ruleConfig.allowedValues) || [];

  if (normalized === undefined) {
    return {
      checkId: check.id,
      status: 'fail',
      severity: check.severity,
      details: `Field "${check.fieldKey}" is not set.`,
    };
  }

  if (allowedValues.includes(normalized)) {
    return {
      checkId: check.id,
      status: 'pass',
      severity: check.severity,
      details: `Value "${normalized}" is allowed.`,
    };
  }

  return {
    checkId: check.id,
    status: 'fail',
    severity: check.severity,
    details: `Value "${normalized}" is not in allowed set: ${allowedValues.join(', ')}.`,
  };
}

function evalTextContains(check, fields) {
  const value = getFieldValue(fields, check.fieldKey);
  const text = (value || '').toString().toLowerCase();
  const cfg = check.ruleConfig || {};
  const phrases = Array.isArray(cfg.phrases) ? cfg.phrases : [];
  const mode = cfg.matchMode === 'all' ? 'all' : 'any';

  if (!text.trim()) {
    return {
      checkId: check.id,
      status: 'fail',
      severity: check.severity,
      details: 'Field is empty, cannot search for phrases.',
    };
  }

  const hits = phrases.filter((p) => text.includes(p.toLowerCase()));

  const ok =
    mode === 'any'
      ? hits.length > 0
      : hits.length === phrases.length;

  if (ok) {
    return {
      checkId: check.id,
      status: 'pass',
      severity: check.severity,
      details: hits.length
        ? `Found phrase(s): ${hits.join(', ')}.`
        : 'Text present.',
    };
  }

  const missing = phrases.filter((p) => !hits.includes(p));

  return {
    checkId: check.id,
    status: 'fail',
    severity: check.severity,
    details: `Missing expected phrase(s): ${missing.join(', ')}.`,
  };
}

// ---- Dispatcher + template-level evaluation ----

export function evaluateCheck(check, fields) {
  switch (check.ruleType) {
    case 'requiredField':
      return evalRequiredField(check, fields);
    case 'textMinLength':
      return evalTextMinLength(check, fields);
    case 'requiredLabel':
      return evalRequiredLabel(check, fields);
    case 'fieldInSet':
      return evalFieldInSet(check, fields);
    case 'textContains':
      return evalTextContains(check, fields);
    default:
      return {
        checkId: check.id,
        status: 'not-applicable',
        severity: check.severity || 'info',
        details: `Unknown ruleType "${check.ruleType}".`,
      };
  }
}

export function evaluateTemplate(template, fields) {
  const results = template.checks.map((check) => evaluateCheck(check, fields));

  const hasCriticalFail = results.some(
    (r) =>
      r.status === 'fail' &&
      (r.severity === 'critical' || r.severity === 'high'),
  );
  const hasWarningFail = results.some(
    (r) =>
      r.status === 'fail' &&
      (r.severity === 'warning' || r.severity === 'medium'),
  );

  let overallStatus = 'pass';
  if (hasCriticalFail) {
    overallStatus = 'fail';
  } else if (hasWarningFail) {
    overallStatus = 'mixed';
  }

  const totalChecks = results.length;
  const failing = results.filter((r) => r.status === 'fail');
  const failingCount = failing.length;
  const criticalCount = failing.filter(
    (r) => r.severity === 'critical' || r.severity === 'high',
  ).length;
  const warningCount = failing.filter(
    (r) => r.severity === 'warning' || r.severity === 'medium',
  ).length;

  return {
    templateId: template.id,
    runAt: new Date().toISOString(),
    overallStatus,
    results,
    totalChecks,
    failingCount,
    criticalCount,
    warningCount,
  };
}

export function evaluateTemplateById(templateId, fields) {
  const template = getTemplateById(templateId);
  if (!template) {
    throw new Error(`Unknown template: ${templateId}`);
  }
  return evaluateTemplate(template, fields);
}

// Re-export template helpers to keep imports simple
export { listTemplates, getTemplateById };
