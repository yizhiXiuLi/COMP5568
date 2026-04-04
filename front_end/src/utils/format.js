// 简化版：无需ethers，直接处理数字
/**
 * 将合约大数转为人类可读数字
 * @param {number|string} amount 模拟的大数/数字
 * @param {number} decimals 精度（wBTC=8，稳定币=18）
 * @returns {string} 格式化后的字符串
 */
export const fromWei = (amount, decimals = 18) => {
  if (typeof amount === 'object' && amount.toNumber) {
    amount = amount.toNumber();
  }
  const num = Number(amount) / (10 ** decimals);
  return num.toFixed(4).replace(/\.?0*$/, '');
};

/**
 * 将页面输入转为合约大数（模拟）
 * @param {string|number} amount 页面输入的数字
 * @param {number} decimals 精度
 * @returns {number} 模拟的大数
 */
export const toWei = (amount, decimals = 18) => {
  return Number(amount) * (10 ** decimals);
};

/**
 * 计算APY（模拟）
 * @param {number|string} ratePerBlock 每区块利率
 * @returns {string} 年利率百分比
 */
export const calculateAPY = (ratePerBlock) => {
  const BLOCKS_PER_YEAR = 2102400;
  const rate = Number(ratePerBlock);
  const apy = (Math.pow(1 + rate, BLOCKS_PER_YEAR) - 1) * 100;
  return apy.toFixed(2);
};