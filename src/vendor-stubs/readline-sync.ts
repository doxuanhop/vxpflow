/** Stub cho gói "readline-sync" — fengari (ldblib) require nhưng chỉ dùng khi gỡ lỗi console. */
export const setDefaultOptions = (): void => undefined;
export const prompt = (): string => '';
export const question = (): string => '';
export const keyInYN = (): boolean => true;
export const questionInt = (): number => 0;
export default { setDefaultOptions, prompt, question, keyInYN, questionInt };
