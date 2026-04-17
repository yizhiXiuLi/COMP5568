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

// 统一 Sepolia 时间基准：12秒/块
const BLOCKS_PER_YEAR = 2628000; 

/**
 * 1. 借款使用 APR (单利)
 * 公式：Rate * Blocks * 100
 */
export const calculateAPR = (ratePerBlock) => {
  try {
    if (!ratePerBlock || ratePerBlock.toString() === '0') return '0.00';
    const rate = parseFloat(ethers.formatUnits(ratePerBlock, 18));
    
    let apr = rate * BLOCKS_PER_YEAR * 100;
    
    // 缩放修正：如果 APR 异常高，说明合约精度偏移，进行校准
    if (apr > 500) apr = apr / 100; 
    
    return isFinite(apr) ? apr.toFixed(2) : "0.00";
  } catch (e) {
    return "0.00";
  }
};

/**
 * 2. 存款使用 APY (复利)
 * 公式：(1 + Rate)^Blocks - 1
 */
export const calculateAPY = (ratePerBlock) => {
  try {
    if (!ratePerBlock || ratePerBlock.toString() === '0') return '0.00';

    let rate = parseFloat(ethers.formatUnits(ratePerBlock, 18));
    rate = rate / 100;

    // 复利计算
    const apy = (Math.pow(1 + rate, BLOCKS_PER_YEAR) - 1) * 100;

    return isFinite(apy) ? apy.toFixed(2) : "0.00";
  } catch (e) {
    return "0.00";
  }
};