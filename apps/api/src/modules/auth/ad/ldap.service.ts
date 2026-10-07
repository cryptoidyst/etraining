import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, Attribute, Entry } from 'ldapts';
import { AdDirectory, AdUserRecord } from './ad-directory.interface';

const UF_ACCOUNTDISABLE = 0x0002;

@Injectable()
export class LdapService implements AdDirectory {
  private readonly logger = new Logger(LdapService.name);

  constructor(private readonly config: ConfigService) {}

  private get url(): string {
    return this.config.get<string>('ad.url', '');
  }

  private get baseDn(): string {
    return this.config.get<string>('ad.baseDn', '');
  }

  private get bindDn(): string {
    return this.config.get<string>('ad.bindDn', '');
  }

  private get bindPassword(): string {
    return this.config.get<string>('ad.bindPassword', '');
  }

  private get timeoutMs(): number {
    return this.config.get<number>('ad.timeoutMs', 10000);
  }

  private attr(name: keyof AdAttributeConfig): string {
    return this.config.get<string>(`ad.attrs.${name}`, name);
  }

  private createClient(): Client {
    const tlsRejectUnauthorized = this.config.get<boolean>('ad.tlsRejectUnauthorized', true);
    return new Client({
      url: this.url,
      timeout: this.timeoutMs,
      connectTimeout: this.timeoutMs,
      tlsOptions: {
        rejectUnauthorized: tlsRejectUnauthorized,
      },
    });
  }

  private async bindAs(dn: string, password: string): Promise<void> {
    const client = this.createClient();
    try {
      await client.bind(dn, password);
    } finally {
      await this.safeUnbind(client);
    }
  }

  private async safeUnbind(client: Client): Promise<void> {
    try {
      await client.unbind();
    } catch {
      /* connection already closed */
    }
  }

  async findUserByUsername(username: string): Promise<AdUserRecord | null> {
    const normalized = this.normalizeUsername(username);
    const usernameAttr = this.attr('username');

    const client = this.createClient();
    try {
      await client.bind(this.bindDn, this.bindPassword);

      const { searchEntries } = await client.search(this.baseDn, {
        scope: 'sub',
        filter: `(&(objectCategory=person)(objectClass=user)(${usernameAttr}=${escapeFilterValue(normalized)}))`,
        attributes: [
          usernameAttr,
          this.attr('email'),
          this.attr('fullName'),
          this.attr('employeeId'),
          this.attr('department'),
          this.attr('jobTitle'),
          this.attr('groups'),
          this.attr('enabled'),
        ],
      });

      if (searchEntries.length === 0) {
        this.logger.warn(`AD user not found: ${normalized}`);
        return null;
      }

      return this.mapEntry(searchEntries[0], normalized);
    } finally {
      await this.safeUnbind(client);
    }
  }

  async verifyUserCredentials(dn: string, password: string): Promise<boolean> {
    if (!password) return false;
    try {
      await this.bindAs(dn, password);
      return true;
    } catch (error) {
      this.logger.warn(`AD user bind failed for ${dn}: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Accepts "jdoe", "DOMAIN\\jdoe", or "jdoe@domain" and returns the bare username.
   */
  normalizeUsername(raw: string): string {
    let value = raw.trim();
    const netbios = this.config.get<string>('ad.netbios', '');
    const domain = this.config.get<string>('ad.domain', '');

    if (value.includes('\\')) {
      const [prefix, rest] = value.split('\\');
      if (!netbios || prefix.toUpperCase() === netbios.toUpperCase()) {
        value = rest;
      }
    } else if (value.includes('@')) {
      const [user, suffix] = value.split('@');
      if (!domain || suffix.toLowerCase() === domain.toLowerCase()) {
        value = user;
      }
    }
    return value;
  }

  private mapEntry(entry: Entry, username: string): AdUserRecord {
    const groups = toArray(entry[this.attr('groups')]).map((dn) => extractCn(dn));
    const uac = Number.parseInt(String(firstValue(entry[this.attr('enabled')]) ?? '0'), 10);

    return {
      username,
      dn: entry.dn,
      fullName: firstValue(entry[this.attr('fullName')]) ?? username,
      email: firstValue(entry[this.attr('email')]),
      employeeId: firstValue(entry[this.attr('employeeId')]),
      department: firstValue(entry[this.attr('department')]),
      jobTitle: firstValue(entry[this.attr('jobTitle')]),
      groups,
      enabled: Number.isNaN(uac) ? true : (uac & UF_ACCOUNTDISABLE) === 0,
    };
  }
}

type AdAttributeConfig = {
  username: string;
  email: string;
  fullName: string;
  employeeId: string;
  department: string;
  jobTitle: string;
  groups: string;
  enabled: string;
};

type LdapValue = Attribute | Attribute[] | undefined;

// LDAP attributes are string | Buffer | (string | Buffer)[]; String() coerces
// them to the textual value we need.
/* eslint-disable @typescript-eslint/no-base-to-string */
function firstValue(value: LdapValue | string | string[] | Buffer | Buffer[]): string | null {
  if (value === undefined) return null;
  if (Array.isArray(value)) {
    return value.length > 0 ? String(value[0]) : null;
  }
  return String(value);
}

function toArray(value: LdapValue | string | string[] | Buffer | Buffer[]): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value.map(String) : [String(value)];
}
/* eslint-enable @typescript-eslint/no-base-to-string */

function extractCn(groupDn: string): string {
  const match = /^CN=([^,]+)/i.exec(groupDn.trim());
  return match ? match[1] : groupDn;
}

/** Escape characters that have special meaning in an LDAP filter (RFC 4515). */
function escapeFilterValue(value: string): string {
  // eslint-disable-next-line no-control-regex -- \x00 must be escaped per RFC 4515
  return value.replace(/[\\*()\u0000]/g, (char) => {
    const code = char.charCodeAt(0).toString(16).padStart(2, '0');
    return `\\${code}`;
  });
}
