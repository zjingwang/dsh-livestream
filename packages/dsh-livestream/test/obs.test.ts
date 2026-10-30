import { describe, expect, it } from 'vitest';
import { ENCODER_ID, streamEncoderJson } from '../src/body/obs';

describe('obs encoder settings', () => {
  it('maps encoders to OBS internal ids', () => {
    expect(ENCODER_ID.nvenc).toBe('obs_nvenc_h264_tex');
    expect(ENCODER_ID.x264).toBe('obs_x264');
  });

  it('nvenc: CBR + keyint 2 + quality tuning, bitrate follows kbps', () => {
    const json = JSON.parse(streamEncoderJson('nvenc', 3000)) as Record<string, unknown>;
    expect(json.rate_control).toBe('CBR');
    expect(json.bitrate).toBe(3000);
    expect(json.keyint_sec).toBe(2);
    expect(json.preset2).toBe('p6');
    expect(json.psycho_aq).toBe(true);
  });

  it('x264: CBR + keyint 2 + veryfast/zerolatency, bitrate follows kbps', () => {
    const json = JSON.parse(streamEncoderJson('x264', 4500)) as Record<string, unknown>;
    expect(json.rate_control).toBe('CBR');
    expect(json.bitrate).toBe(4500);
    expect(json.keyint_sec).toBe(2);
    expect(json.preset).toBe('veryfast');
    expect(json.tune).toBe('zerolatency');
  });
});
