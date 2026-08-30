import {GetObjectCommand, S3Client} from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';

export interface SignObjectUrlRequest {
    bucket: string;
    key: string;
    expiresInSeconds: number;
}

export const s3Client = {
    signObjectUrl,
};

const client = new S3Client();

export async function signObjectUrl(request: SignObjectUrlRequest): Promise<string> {
    const command = new GetObjectCommand({Bucket: request.bucket, Key: request.key});
    return getSignedUrl(client, command, {expiresIn: request.expiresInSeconds});
}
