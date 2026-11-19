import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isUploadUrl } from './upload-url';

test('photos : uniquement le compte Cloudinary du projet', () => {
  process.env.CLOUDINARY_CLOUD_NAME = 'moncloud';
  assert.ok(isUploadUrl('https://res.cloudinary.com/moncloud/image/upload/v1/plateforme-auto/a.jpg'));
  for (const bad of ['https://res.cloudinary.com/autrecloud/image/upload/a.jpg', 'http://res.cloudinary.com/moncloud/a.jpg', 'https://evil.io/moncloud/a.jpg', 'https://res.cloudinary.com.evil.io/moncloud/a.jpg', 'javascript:alert(1)', 'https://x@res.cloudinary.com/moncloud/a.jpg', 42]) assert.ok(!isUploadUrl(bad), String(bad));
});
