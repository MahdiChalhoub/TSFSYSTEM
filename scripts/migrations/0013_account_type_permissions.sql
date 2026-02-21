-- Finance Account Type Permissions: v1.12.8-b001
-- Seeds 10 permissions for per-type RBAC on financial accounts

INSERT INTO permission (code, name, description) VALUES
    ('finance.account.cash', 'Access Cash Drawers', 'View and manage Cash Drawer accounts')
    ON CONFLICT (code) DO NOTHING;
INSERT INTO permission (code, name, description) VALUES
    ('finance.account.bank', 'Access Bank Accounts', 'View and manage Bank accounts')
    ON CONFLICT (code) DO NOTHING;
INSERT INTO permission (code, name, description) VALUES
    ('finance.account.mobile', 'Access Mobile Wallets', 'View and manage Mobile Wallet accounts')
    ON CONFLICT (code) DO NOTHING;
INSERT INTO permission (code, name, description) VALUES
    ('finance.account.petty_cash', 'Access Petty Cash', 'View and manage Petty Cash accounts')
    ON CONFLICT (code) DO NOTHING;
INSERT INTO permission (code, name, description) VALUES
    ('finance.account.savings', 'Access Savings Accounts', 'View and manage Savings accounts')
    ON CONFLICT (code) DO NOTHING;
INSERT INTO permission (code, name, description) VALUES
    ('finance.account.foreign', 'Access Foreign Currency', 'View and manage Foreign Currency accounts')
    ON CONFLICT (code) DO NOTHING;
INSERT INTO permission (code, name, description) VALUES
    ('finance.account.escrow', 'Access Escrow Accounts', 'View and manage Escrow accounts')
    ON CONFLICT (code) DO NOTHING;
INSERT INTO permission (code, name, description) VALUES
    ('finance.account.investment', 'Access Investment Accounts', 'View and manage Investment accounts')
    ON CONFLICT (code) DO NOTHING;
INSERT INTO permission (code, name, description) VALUES
    ('finance.account.all', 'Access All Account Types', 'Bypass per-type filtering — see all accounts')
    ON CONFLICT (code) DO NOTHING;
INSERT INTO permission (code, name, description) VALUES
    ('finance.account.manage', 'Create/Delete Accounts', 'Permission to create and delete financial accounts')
    ON CONFLICT (code) DO NOTHING;
