import { uiAccess } from '../index';

export function smokeResolve() {
  const login = uiAccess.experience('auth.login');
  const submit = uiAccess.node('node.auth.login.submit-button');
  const gift = uiAccess.asset('gift.normal.rose');
  const contract = uiAccess.contract('contract.button.action.v1');
  const content = uiAccess.content('content.auth.login.submit-button');
  return { login, submit, gift, contract, content, snapshot: uiAccess.snapshot() };
}
