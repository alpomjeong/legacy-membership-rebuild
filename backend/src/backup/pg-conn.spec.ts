import { parseDatabaseUrl, buildDumpArgs, buildRestoreArgs } from './pg-conn';

describe('parseDatabaseUrl', () => {
  it('parses host/port/db/user/password from a DATABASE_URL', () => {
    const c = parseDatabaseUrl(
      'postgresql://temple:secret@db.local:5433/temple?schema=public',
    );
    expect(c).toEqual({
      host: 'db.local',
      port: 5433,
      database: 'temple',
      user: 'temple',
      password: 'secret',
    });
  });

  it('defaults port to 5432 when absent', () => {
    expect(parseDatabaseUrl('postgresql://u:p@localhost/temple').port).toBe(
      5432,
    );
  });

  it('url-decodes user and password', () => {
    const c = parseDatabaseUrl(
      'postgresql://te%40mple:p%40ss%3Aword@localhost:5432/temple',
    );
    expect(c.user).toBe('te@mple');
    expect(c.password).toBe('p@ss:word');
  });
});

describe('buildDumpArgs', () => {
  it('builds pg_dump custom-format args with NO password in argv', () => {
    const c = {
      host: 'localhost',
      port: 5432,
      database: 'temple',
      user: 'temple',
      password: 'secret',
    };
    const args = buildDumpArgs(c, 'C:\\bk\\temple-x.dump');
    expect(args).toEqual([
      '-h',
      'localhost',
      '-p',
      '5432',
      '-U',
      'temple',
      '-d',
      'temple',
      '-Fc',
      '-f',
      'C:\\bk\\temple-x.dump',
    ]);
    expect(args).not.toContain('secret');
  });
});

describe('buildRestoreArgs', () => {
  it('builds pg_restore args with --clean --if-exists --no-owner', () => {
    const c = {
      host: 'localhost',
      port: 5432,
      database: 'temple',
      user: 'temple',
      password: 'secret',
    };
    const args = buildRestoreArgs(c, 'C:\\bk\\temple-x.dump');
    expect(args).toEqual([
      '-h',
      'localhost',
      '-p',
      '5432',
      '-U',
      'temple',
      '-d',
      'temple',
      '--clean',
      '--if-exists',
      '--no-owner',
      'C:\\bk\\temple-x.dump',
    ]);
    expect(args).not.toContain('secret');
  });
});
