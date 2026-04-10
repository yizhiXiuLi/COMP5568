import { ethers } from 'ethers';
import { fromWei } from './format';

/**
 * 校验借款金额是否超过最大可借额度
 */
export const validateBorrowAmount = (inputAmount, maxBorrowable) => {
  const input = parseFloat(inputAmount);
  // 确保 maxBorrowable 转换为数字进行比较
  const max = parseFloat(fromWei(maxBorrowable));
  
  if (isNaN(input) || input <= 0) return false;
  return input <= max;
};

/**
 * 预估借款后的健康因子
 * 注意：传入的参数可能是来自 store 的 String
 * @param {string|number} totalCollateralUSD 账户当前的抵押品总价值 (已折算USD)
 * @param {string|number} totalDebtUSD 账户当前的债务总价值 (已折算USD)
 * @param {string|number} inputBorrowAmount 用户在输入框输入的拟借款额 (稳定币)
 * @param {number} collateralFactor 抵押因子 (例如 0.8)
 */
export const estimateHealthFactor = (
  totalCollateralUSD,
  totalDebtUSD,
  inputBorrowAmount,
  collateralFactor = 0.8
) => {
  const collateral = parseFloat(totalCollateralUSD || 0);
  const currentDebt = parseFloat(totalDebtUSD || 0);
  const newBorrow = parseFloat(inputBorrowAmount || 0);

  const totalNewDebt = currentDebt + newBorrow;

  // 如果借款后总债务为0，健康因子为无穷大
  if (totalNewDebt <= 0) return Infinity;

  // 公式：(总抵押价值 * 抵押因子) / 总债务
  const hf = (collateral * collateralFactor) / totalNewDebt;
  return hf;
};

export const isHfSafe = (hf) => {
  if (hf === '∞' || hf === Infinity) return true;
  const val = parseFloat(hf);
  return !isNaN(val) && val >= 1.1; // 1.1 为清算阈值缓冲区
};