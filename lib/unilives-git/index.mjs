/**
 * Git provider abstraction around GitHub — does not rebuild Git.
 */

export function createUniLiveGit(options = {}) {
  return {
    provider: options.provider || 'github',
    async getRepository() {
      return options.repository || { fullName: null, defaultBranch: 'main' };
    },
    async getCommit(sha) {
      return { sha, provider: 'github' };
    },
    async getCiStatus(sha) {
      return { sha, status: options.ciStatus || 'unknown' };
    },
  };
}
