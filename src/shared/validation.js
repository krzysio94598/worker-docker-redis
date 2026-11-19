/**
 * Validates a job object
 * @param {Object} job - The job object to validate
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
function validateJob(job) {
  const errors = [];

  if (!job || typeof job !== 'object') {
    errors.push('Job must be an object');
    return { valid: false, errors };
  }

  if (!job.id) {
    errors.push('Job must have an id');
  } else if (typeof job.id !== 'string' && typeof job.id !== 'number') {
    errors.push('Job id must be a string or number');
  }

  if (!job.documentId) {
    errors.push('Job must have a documentId');
  } else if (typeof job.documentId !== 'string' && typeof job.documentId !== 'number') {
    errors.push('Job documentId must be a string or number');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a job status value
 * @param {string} status - The status to validate
 * @returns {boolean}
 */
function isValidStatus(status) {
  const validStatuses = ['queued', 'processing', 'completed', 'failed'];
  return validStatuses.includes(status);
}

module.exports = {
  validateJob,
  isValidStatus,
};
