import { fallbackAssessment } from '../../src/services/riskAssessment.service';

describe('fallbackAssessment', () => {
  it('scores SOS alerts highest among categories', () => {
    const sos = fallbackAssessment({ title: '', description: '', category: 'sos', severity: 'critical', nearbyAlertCount: 0 });
    const unsafe = fallbackAssessment({ title: '', description: '', category: 'unsafe_area', severity: 'low', nearbyAlertCount: 0 });
    expect(sos.riskScore).toBeGreaterThan(unsafe.riskScore);
  });

  it('never returns a score above 100 even with a large hotspot boost', () => {
    const result = fallbackAssessment({ title: '', description: '', category: 'sos', severity: 'critical', nearbyAlertCount: 999 });
    expect(result.riskScore).toBeLessThanOrEqual(100);
  });

  it('labels urgency consistently with the score bands', () => {
    const critical = fallbackAssessment({ title: '', description: '', category: 'sos', severity: 'critical', nearbyAlertCount: 0 });
    expect(critical.riskScore).toBeGreaterThanOrEqual(80);
    expect(critical.urgencyLabel).toBe('critical');
  });

  it('falls back to a sane default for an unknown category', () => {
    const result = fallbackAssessment({ title: '', description: '', category: 'unknown_category', severity: 'low', nearbyAlertCount: 0 });
    expect(result.riskScore).toBe(40);
  });
});