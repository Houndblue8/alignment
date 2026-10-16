import { expect, test } from 'vitest';
import { intentionPrompt } from './intention';

test('each Big 3 item gets a prompt that fits it', () => {
  expect(intentionPrompt({ title: 'Study', journey: 'school' })).toBe('What are you studying for?');
  expect(intentionPrompt({ title: 'Lift', journey: 'sport' })).toBe('What are you targeting?');
  expect(intentionPrompt({ title: 'Model Chaz at practice', journey: 'sport' })).toBe('One thing to work on');
  expect(intentionPrompt({ title: 'Outreach', journey: 'shs' })).toBe('Your outreach number today');
  expect(intentionPrompt({ title: 'Patch the app', journey: 'shs' })).toBe('What does done look like?');
  expect(intentionPrompt({ title: 'Intentional at large group', journey: 'faith' })).toBe('One thing to focus on with God');
  expect(intentionPrompt({ title: 'Dinner with Josh', journey: 'life' })).toBe('One person or thing to focus on');
  expect(intentionPrompt({ title: 'Laundry', journey: 'body' })).toBe('What does done look like?');
});
