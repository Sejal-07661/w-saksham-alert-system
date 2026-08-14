import { startJourneySchema, updateJourneyLocationSchema } from '../../src/schemas/journey.schema';

describe('startJourneySchema', () => {
  it('accepts a valid payload', () => {
    const result = startJourneySchema.safeParse({
      startLatitude: 21.1458, startLongitude: 79.0882,
      endLatitude: 21.1500, endLongitude: 79.0950,
    });
    expect(result.success).toBe(true);
  });

  it('rejects an out-of-range latitude', () => {
    const result = startJourneySchema.safeParse({
      startLatitude: 200, startLongitude: 79.0882,
      endLatitude: 21.1500, endLongitude: 79.0950,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a deviation threshold below the allowed minimum', () => {
    const result = startJourneySchema.safeParse({
      startLatitude: 21.1458, startLongitude: 79.0882,
      endLatitude: 21.1500, endLongitude: 79.0950,
      deviationThresholdMeters: 10,
    });
    expect(result.success).toBe(false);
  });
});

describe('updateJourneyLocationSchema', () => {
  it('rejects missing coordinates', () => {
    const result = updateJourneyLocationSchema.safeParse({ latitude: 21.1458 });
    expect(result.success).toBe(false);
  });
});