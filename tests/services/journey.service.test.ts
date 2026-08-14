import { haversineMeters, distanceToCorridorMeters, checkDeviation } from '../../src/services/journey.service';
import { IJourney } from '../../src/models/journey.model';

describe('haversineMeters', () => {
  it('returns 0 for identical points', () => {
    expect(haversineMeters(21.1458, 79.0882, 21.1458, 79.0882)).toBeCloseTo(0, 1);
  });

  it('returns a known real-world distance within tolerance', () => {
    const distance = haversineMeters(21.1458, 79.0882, 21.1500, 79.0950);
    expect(distance).toBeGreaterThan(700);
    expect(distance).toBeLessThan(900);
  });
});

describe('distanceToCorridorMeters', () => {
  const start = { lat: 21.1458, lon: 79.0882 };
  const end = { lat: 21.1500, lon: 79.0950 };

  it('returns ~0 for a point exactly on the start', () => {
    const distance = distanceToCorridorMeters(start, start, end);
    expect(distance).toBeCloseTo(0, 1);
  });

  it('returns a large distance for a point far off the corridor', () => {
    const distance = distanceToCorridorMeters({ lat: 21.1700, lon: 79.1200 }, start, end);
    expect(distance).toBeGreaterThan(3000);
    expect(distance).toBeLessThan(3800);
  });
});

describe('checkDeviation', () => {
  function buildJourney(thresholdMeters = 500): IJourney {
    return {
      startLocation: { type: 'Point', coordinates: [79.0882, 21.1458] },
      endLocation: { type: 'Point', coordinates: [79.0950, 21.1500] },
      deviationThresholdMeters: thresholdMeters,
    } as IJourney;
  }

  it('does not flag deviation for a point on the route', () => {
    const journey = buildJourney();
    const result = checkDeviation(journey, 21.1479, 79.0916);
    expect(result.deviated).toBe(false);
  });

  it('flags deviation for a point far off the route', () => {
    const journey = buildJourney();
    const result = checkDeviation(journey, 21.1700, 79.1200);
    expect(result.deviated).toBe(true);
    expect(result.distanceMeters).toBeGreaterThan(journey.deviationThresholdMeters);
  });

  it('respects a custom deviation threshold', () => {
    const journey = buildJourney(5000);
    const result = checkDeviation(journey, 21.1700, 79.1200);
    expect(result.deviated).toBe(false);
  });
});