export const LATEST_RECORD_ID = 'record-2';

export const DEMO_AI_DIAGNOSIS = [
  '植物名称：栀子花',
  '健康状态：健康',
  '问题描述：植株整体长势良好，叶片颜色正常，无明显病害迹象',
  '养护建议：保持适度浇水，避免积水；提供充足散射光；定期通风',
].join('\n');

export function getDemoDiagnosis(recordId?: string | null) {
  if (recordId === LATEST_RECORD_ID) {
    return DEMO_AI_DIAGNOSIS;
  }

  return '';
}
