import { promises as fs } from 'node:fs';

import { type SessionRepository } from '@core-application';
import { type Session, SessionNotFoundError } from '@core-domain';

import { resolveWithinRoot } from '../utils/path-utils.util';

export class FileSystemSessionRepository implements SessionRepository {
  constructor(private readonly sessionRoot: string) {}

  private toPersist(session: Session): Omit<Session, 'createdAt' | 'updatedAt'> & {
    createdAt: string;
    updatedAt: string;
  } {
    return {
      ...session,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    };
  }

  /**
   * Construit le chemin absolu du fichier de session, en restant confiné
   * dans le répertoire racine (via resolveWithinRoot).
   */
  private getSessionFilePath(sessionId: string): string {
    return resolveWithinRoot(this.sessionRoot, `${sessionId}.json`);
  }

  /**
   * Sérialise une Session vers un objet JSON safe (dates → ISO string).
   */
  private serialize(session: Session) {
    return this.toPersist(session);
  }

  /**
   * Désérialise le JSON brut en Session, en recréant les Date.
   * (Tu peux ajouter plus de validation si nécessaire.)
   */
  private deserialize(raw: Session & { createdAt: string; updatedAt: string }): Session {
    return {
      ...raw,
      createdAt: new Date(raw.createdAt),
      updatedAt: new Date(raw.updatedAt),
    };
  }

  /**
   * Création d'une nouvelle session.
   * Échoue si le fichier existe déjà (EEXIST).
   */
  async create(session: Session): Promise<void> {
    const filePath = this.getSessionFilePath(session.id);

    await fs.mkdir(this.sessionRoot, { recursive: true });

    const payload = JSON.stringify(this.serialize(session), null, 2);

    try {
      // 'wx' => écriture exclusive, échoue si le fichier existe déjà
      await fs.writeFile(filePath, payload, { flag: 'wx' });
    } catch (err: unknown) {
      const code = (err as { code?: string } | undefined)?.code;
      if (code === 'EEXIST') {
        // À toi de voir : soit tu laisses l'erreur brute,
        // soit tu jettes un SessionInvalidError.
        throw err;
      }
      throw err;
    }
  }

  /**
   * Recherche d'une session par ID.
   * - retourne null si elle n'existe pas
   * - relance l'erreur pour tout autre problème (IO, JSON, etc.)
   */
  async findById(id: string): Promise<Session | null> {
    const filePath = this.getSessionFilePath(id);

    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as Session & { createdAt: string; updatedAt: string };
      return this.deserialize(parsed);
    } catch (err: unknown) {
      const code = (err as { code?: string } | undefined)?.code;
      if (code === 'ENOENT') {
        return null;
      }
      throw err;
    }
  }

  /**
   * Sauvegarde d'une session existante.
   * Ici je pars du principe que la session doit exister.
   * Si tu préfères un "upsert", tu peux enlever le check.
   */
  async save(session: Session): Promise<void> {
    const filePath = this.getSessionFilePath(session.id);

    // Optionnel : vérifier que la session existe déjà
    try {
      await fs.access(filePath);
    } catch (err: unknown) {
      const code = (err as { code?: string } | undefined)?.code;
      if (code === 'ENOENT') {
        // session inexistante → tu peux soit créer, soit jeter une SessionNotFoundError
        throw new SessionNotFoundError(session.id);
      }
      throw err;
    }

    const payload = JSON.stringify(this.serialize(session), null, 2);
    await fs.writeFile(filePath, payload, { flag: 'w' });
  }
}
