import { Client, Account, Databases, Storage } from 'appwrite';

export const appwriteConfig = {
  endpoint: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1',
  projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '',
  databaseId: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || '',
  usersCollectionId: process.env.NEXT_PUBLIC_APPWRITE_USERS_TABLE_ID || '',
  skillsCollectionId: process.env.NEXT_PUBLIC_APPWRITE_SKILLS_TABLE_ID || '',
  avatarsBucketId: process.env.NEXT_PUBLIC_APPWRITE_AVATARS_BUCKET_ID || ''
};

const client = new Client()
  .setEndpoint(appwriteConfig.endpoint)
  .setProject(appwriteConfig.projectId);

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);

export default client;
