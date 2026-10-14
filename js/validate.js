import { normalizeName } from './entry-id.js';

export const NAME_MAX_LENGTH = 20;
export const MESSAGE_MAX_LENGTH = 200;

export function validateEntry({ name, phone4, message }) {
  const errors = {};
  const normalizedName = normalizeName(name);
  const trimmedMessage = (message ?? '').trim();

  if (normalizedName.length === 0) {
    errors.name = '이름을 입력해주세요.';
  } else if (normalizedName.length > NAME_MAX_LENGTH) {
    errors.name = `이름은 ${NAME_MAX_LENGTH}자 이하로 입력해주세요.`;
  } else if (normalizedName.includes('/')) {
    errors.name = '이름에 / 문자는 쓸 수 없어요.';
  }

  if (!/^\d{4}$/.test(phone4 ?? '')) {
    errors.phone4 = '전화번호 뒤 4자리를 숫자 4자리로 입력해주세요.';
  }

  if (trimmedMessage.length === 0) {
    errors.message = '메시지를 입력해주세요.';
  } else if (trimmedMessage.length > MESSAGE_MAX_LENGTH) {
    errors.message = `메시지는 ${MESSAGE_MAX_LENGTH}자 이하로 입력해주세요.`;
  }

  return { valid: Object.keys(errors).length === 0, errors };
}