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
 */
export const estimateHealthFactor = (
  currentCollateral, // USD 价值 (String 或 Number)
  currentDebt,       // USD 债务 (String 或 Number)
  borrowAmount,      // 输入的借款额 (Number)
  collateralFactor = 0.8
) => {
  const collateralValue = parseFloat(currentCollateral) * collateralFactor;
  const newDebt = parseFloat(currentDebt) + parseFloat(borrowAmount);
  
  // 如果借款后依然没有债务，返回 Infinity
  if (newDebt <= 0) return Infinity;
  
  return collateralValue / newDebt;
};

/**
 * 校验健康因子是否安全
 * @param {number|string} hf 
 */
export const isHfSafe = (hf) => {
  // 处理 store 中的特殊字符 "∞"
  if (hf === '∞' || hf === Infinity) return true;
  
  const val = parseFloat(hf);
  if (isNaN(val)) return false;
  
  return val >= 1.1;
};