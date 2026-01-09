/**
 * Braindump - Documents Module
 *
 * Handles API communication for document CRUD operations.
 */

const API_BASE = '/api';

export class DocumentManager {
    constructor() {
        this.cache = new Map();
    }

    async list() {
        try {
            const response = await fetch(`${API_BASE}/documents`);
            if (!response.ok) throw new Error('Failed to fetch documents');

            const docs = await response.json();

            // Update cache
            docs.forEach(doc => this.cache.set(doc.id, doc));

            return docs;
        } catch (error) {
            console.error('Error listing documents:', error);
            return [];
        }
    }

    async get(id) {
        try {
            const response = await fetch(`${API_BASE}/documents/${id}`);
            if (!response.ok) throw new Error('Document not found');

            const doc = await response.json();
            this.cache.set(id, doc);

            return doc;
        } catch (error) {
            console.error('Error fetching document:', error);
            return null;
        }
    }

    async create(content = '') {
        try {
            const response = await fetch(`${API_BASE}/documents`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content }),
            });

            if (!response.ok) throw new Error('Failed to create document');

            const doc = await response.json();
            this.cache.set(doc.id, doc);

            return doc;
        } catch (error) {
            console.error('Error creating document:', error);
            throw error;
        }
    }

    async update(id, content) {
        try {
            const response = await fetch(`${API_BASE}/documents/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content }),
            });

            if (!response.ok) throw new Error('Failed to update document');

            const doc = await response.json();
            this.cache.set(id, doc);

            return doc;
        } catch (error) {
            console.error('Error updating document:', error);
            throw error;
        }
    }

    async delete(id) {
        try {
            const response = await fetch(`${API_BASE}/documents/${id}`, {
                method: 'DELETE',
            });

            if (!response.ok) throw new Error('Failed to delete document');

            this.cache.delete(id);
            return true;
        } catch (error) {
            console.error('Error deleting document:', error);
            throw error;
        }
    }

    async archive(id) {
        try {
            const response = await fetch(`${API_BASE}/documents/${id}/archive`, {
                method: 'POST',
            });

            if (!response.ok) throw new Error('Failed to archive document');

            this.cache.delete(id);
            return true;
        } catch (error) {
            console.error('Error archiving document:', error);
            throw error;
        }
    }

    async unarchive(id) {
        try {
            const response = await fetch(`${API_BASE}/documents/${id}/unarchive`, {
                method: 'POST',
            });

            if (!response.ok) throw new Error('Failed to unarchive document');

            return true;
        } catch (error) {
            console.error('Error unarchiving document:', error);
            throw error;
        }
    }

    getCached(id) {
        return this.cache.get(id);
    }
}
