import type { OptionCondition } from '../content/Condition';
import type { OptionSetting } from './OptionSetting';

/**
 * Câu lỗi khi điều kiện dùng option sai loại hoặc `equals` không khớp; `undefined` là điều kiện hợp lệ.
 * Dùng chung cho kiểm tra tĩnh (`checkSettingReferences`) và lúc resolve (`evaluateCondition`) để
 * thông báo nhất quán ở cả 2 nơi.
 */
export function optionConditionError(option: OptionSetting, condition: OptionCondition): string | undefined {
  const name = condition.option;
  if (option.type === 'text') return `option "${name}" kiểu text không dùng được trong điều kiện`;
  if (option.type === 'boolean') {
    if (condition.equals === undefined || typeof condition.equals === 'boolean') return undefined;
    return `equals của option "${name}" phải là true hoặc false`;
  }
  if (condition.equals === undefined) return `option "${name}" kiểu choice cần equals`;

  const values = option.choices.map((choice) => choice.value);
  if (typeof condition.equals === 'string' && values.includes(condition.equals)) return undefined;
  return `equals của option "${name}" phải là 1 trong: ${values.map((value) => `"${value}"`).join(', ')}`;
}
