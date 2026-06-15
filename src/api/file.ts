import { request } from '@/utils/request';

export interface UploadResult {
  url: string;
}

/** 上传单张图片，返回后端给出的相对路径（如 /files/brand/xxx.png）。 */
export async function apiUploadImage(file: File, category = 'common'): Promise<UploadResult> {
  const form = new FormData();
  form.append('file', file);
  form.append('category', category);
  return request.post('/files/upload', form) as unknown as Promise<UploadResult>;
}
