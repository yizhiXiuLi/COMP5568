import { ethers } from 'ethers';

/**
 * 将合约大数转为人类可读数字
 * @param {BigNumber} amount 合约返回的大数
 * @param {number} decimals 精度（wBTC=8，稳定币=18）
 * @returns {string} 格式化后的字符串（保留4位小数）
 */
export const fromWei = (amount, decimals = 18) => {
  if (!amount) return '0.0000';
  // 格式化并保留4位小数，避免科学计数法
  return ethers.formatUnits(amount, decimals)
    .replace(/(\.\d{4})\d+/, '$1') // 保留4位小数
    .replace(/\.?0*$/, ''); // 去掉末尾多余的0
};

/**
 * 将页面输入转为合约大数
 * @param {string|number} amount 页面输入的数字
 * @param {number} decimals 精度（wBTC=8，稳定币=18）
 * @returns {BigNumber} 合约可接受的大数
 */
export const toWei = (amount, decimals = 18) => {
  if (!amount || Number(amount) <= 0) return ethers.parseUnits('0', decimals);
  return ethers.parseUnits(amount.toString(), decimals);
};

/**
 * 计算APY（从每区块利率转年利率）
 * @param {BigNumber} ratePerBlock 每区块利率（合约返回）
 * @returns {string} 年利率百分比（保留2位小数）
 */
export const calculateAPY = (ratePerBlock) => {
  const BLOCKS_PER_YEAR = 2102400;
  const rate = ethers.formatUnits(ratePerBlock, 18);
  const apy = (Math.pow(1 + Number(rate), BLOCKS_PER_YEAR) - 1) * 100;
  return apy.toFixed(2);
};