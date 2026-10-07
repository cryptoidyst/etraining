export interface AdUserRecord {
  username: string;
  dn: string;
  fullName: string;
  email: string | null;
  employeeId: string | null;
  department: string | null;
  jobTitle: string | null;
  groups: string[];
  enabled: boolean;
}

export interface AdDirectory {
  /**
   * Search the directory (using the read-only service account) for a user by
   * their sAMAccountName. Returns null when no matching user exists.
   */
  findUserByUsername(username: string): Promise<AdUserRecord | null>;

  /**
   * Verify a user's own credentials by binding to the directory as that user.
   * Returns true only when the bind succeeds.
   */
  verifyUserCredentials(dn: string, password: string): Promise<boolean>;
}

export const AD_DIRECTORY = Symbol('AD_DIRECTORY');
