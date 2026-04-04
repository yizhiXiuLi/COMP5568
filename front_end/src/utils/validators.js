import { fromWei } from './format';

/**
 * 校验借款金额是否超过最大可借额度
 * @param {string} inputAmount 页面输入金额
 * @param {BigNumber} maxBorrowable 合约返回的最大可借额度
 * @returns {boolean} 是否有效
 */
export const validateBorrowAmount = (inputAmount, maxBorrowable) => {
  const input = Number(inputAmount);
  const max = Number(fromWei(maxBorrowable));
  return input > 0 && input <= max;
};

/**
 * 预估借款后的健康因子
 * @param {number} currentCollateral 当前抵押价值（USD）
 * @param {number} currentDebt 当前债务（USD）
 * @param {number} borrowAmount 拟借款金额（USD）
 * @param {number} collateralFactor 抵押因子（如0.8）
 * @returns {number} 预估健康因子
 */
export const estimateHealthFactor = (
  currentCollateral,
  currentDebt,
  borrowAmount,
  collateralFactor = 0.8
) => {
  const collateralValue = currentCollateral * collateralFactor;
  const newDebt = currentDebt + borrowAmount;
  if (newDebt === 0) return Infinity;
  return collateralValue / newDebt;
};

/**
 * 校验健康因子是否安全（低于1.1警告）
 * @param {number} hf 健康因子值
 * @returns {boolean} 是否安全
 */
export const isHfSafe = (hf) => {
  return hf >= 1.1;
};