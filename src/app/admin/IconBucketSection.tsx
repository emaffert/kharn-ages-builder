import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Catalog } from "@core";
import { Button, Dialog } from "@ui";
import {
  fetchOrphanIcons,
  listBucketIcons,
  mirroredIconCount,
  mirroredIcons,
  removeIcons,
  syncMirrorToBucket,
  type OrphanIcon,
} from "../../lib/icons";
import { supabase } from "../../lib/supabase";
import { Section } from "./primitives";
import { HelpTitle } from "./SectionHelp";

/** Délai de grâce de la purge, en jours. Doit rester cohérent avec le défaut de la migration 0004. */
const GRACE_DAYS = 30;

const ko = (bytes: number) => `${Math.round(bytes / 1024)} Ko`;

/**
 * Aide de la section : d'où viennent les portraits, et ce que font les trois boutons.
 *
 * Le sujet mérite une explication écrite parce qu'il est contre-intuitif : les icônes sont le seul
 * contenu du catalogue qui ne voyage PAS avec lui, et le seul que « Publier » n'envoie pas.
 */
function IconsHelp({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} size="lg" title="Aide - comment fonctionnent les icônes">
      <div className="adm-doc-body">
        <p>
          Les portraits des figurines sont rangés <strong>à part</strong> du catalogue. Ils existent à deux
          endroits, qui doivent rester d'accord - c'est ce que surveille cette section.
        </p>
        <ul className="adm-doc-list">
          <li>
            <strong>Le dépôt</strong> : les portraits livrés avec le site. Ce sont eux qui s'affichent{" "}
            <strong>même sans connexion</strong>.
          </li>
          <li>
            <strong>Le bucket</strong> : l'espace de stockage en ligne. C'est par là qu'arrive un portrait créé
            depuis cette page d'administration, <strong>sans attendre une mise à jour du site</strong>.
          </li>
        </ul>
        <p>
          Les deux contiennent les mêmes images. Le site utilise celles du dépôt quand il les a, et va chercher
          les autres dans le bucket.
        </p>

        <HelpTitle>Créer un portrait</HelpTitle>
        <p>
          Dans le détail d'un profil ou d'une monture, « Créer l'icône… » ouvre l'outil de recadrage. À
          l'enregistrement, l'image part <strong>aussitôt</strong> dans le bucket.
        </p>
        <p>
          Elle n'est visible de personne pour autant : un portrait n'apparaît aux joueurs qu'une fois le
          catalogue <strong>publié</strong>. Vous pouvez donc préparer vos images tranquillement, et changer
          d'avis sans conséquence.
        </p>
        <p>
          Un portrait est <strong>partagé par tous les niveaux</strong> d'un même modèle (I, II, III). Un niveau
          peut avoir le sien à la place, via le second emplacement de son détail.
        </p>

        <HelpTitle>« Synchroniser le bucket »</HelpTitle>
        <p>
          Envoie dans le bucket les portraits qu'il n'a pas encore. À lancer <strong>avant de publier</strong>{" "}
          si le compteur signale des images manquantes : sans cela, les joueurs dont le site n'est pas à jour ne
          les verraient pas.
        </p>
        <p>Sans risque, et à relancer autant de fois que voulu : rien n'est envoyé en double ni remplacé.</p>

        <HelpTitle>« Chercher les orphelines »</HelpTitle>
        <p>
          Un portrait devient orphelin quand <strong>plus aucune version du catalogue ne l'utilise</strong> :
          image remplacée par un meilleur recadrage, profil supprimé, essai abandonné. Il occupe de la place
          sans servir.
        </p>
        <p>
          Le bouton affiche d'abord la liste, vous décidez ensuite. Les portraits de{" "}
          <strong>moins de {GRACE_DAYS} jours</strong> ne sont jamais proposés : ce sont vos images récentes,
          pas encore publiées.
        </p>
        <p>
          La suppression est <strong>définitive</strong>, mais sans danger : ce qui est utilisé par une version
          du catalogue n'est jamais proposé.
        </p>

        <HelpTitle>« Rafraîchir »</HelpTitle>
        <p>
          Recompte les portraits en ligne. Utile si vous en avez ajouté depuis un autre ordinateur ou un autre
          navigateur : les chiffres affichés datent de l'ouverture de la page.
        </p>

        <HelpTitle>L'avertissement orange</HelpTitle>
        <p>
          S'il apparaît, des portraits du catalogue <strong>ne s'afficheront nulle part</strong>. Lancez «
          Synchroniser le bucket », puis publiez.
        </p>
      </div>
    </Dialog>
  );
}

/** Références d'icône citées par le catalogue en cours d'édition, dédoublonnées. */
function referencedIn(cat: Catalog): Set<string> {
  const refs = [
    ...Object.values(cat.icons ?? {}),
    ...cat.profiles.map((p) => p.icon),
    ...cat.mounts.map((m) => m.icon),
  ];
  return new Set(refs.filter((ref): ref is string => ref != null && !ref.startsWith("data:")));
}

/**
 * Section « Icônes » des réglages : état du stockage des portraits, et les deux opérations
 * d'entretien qui vont avec.
 *
 * Les portraits ne sont plus dans le catalogue, ils vivent à deux endroits qui doivent rester
 * d'accord : le **miroir** committé dans le dépôt (précaché, donc valable hors-ligne) et le
 * **bucket** (alimenté par l'éditeur d'icône, donc en avance sur le dernier déploiement). Cette
 * section montre l'écart et permet de le résorber.
 */
export function IconBucketSection({ cat, client = supabase }: { cat: Catalog; client?: SupabaseClient | null }) {
  const [bucket, setBucket] = useState<Set<string> | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<null | string>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [orphans, setOrphans] = useState<OrphanIcon[] | null>(null);
  const [help, setHelp] = useState(false);

  /** Applique un résultat de lecture du bucket (`null` = illisible, à distinguer de « vide »). */
  const applyBucket = useCallback((names: Set<string> | null) => {
    setBucket(names);
    setError(names ? null : "Bucket illisible : la migration 0004 est-elle appliquée ?");
  }, []);

  /** Relecture déclenchée par l'utilisateur, ou après une opération qui a modifié le bucket. */
  const inspect = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    applyBucket(await listBucketIcons(client));
    setLoading(false);
  }, [client, applyBucket]);

  // Première lecture. Gardée par `alive` : la section peut être démontée pendant la requête
  // (changement de page d'admin), et on n'écrit pas dans un composant démonté.
  useEffect(() => {
    if (!client) return;
    let alive = true;
    void (async () => {
      const names = await listBucketIcons(client);
      if (alive) applyBucket(names);
    })();
    return () => {
      alive = false;
    };
  }, [client, applyBucket]);

  if (!client) return null;

  const mirrored = mirroredIconCount();
  const missing = bucket ? mirroredIcons().filter((i) => !bucket.has(i.name)).length : null;
  // Références que ni le dépôt ni le bucket ne servent : l'app les afficherait en trou.
  const mirrorNames = new Set(mirroredIcons().map((i) => i.name));
  const unresolvable = bucket
    ? [...referencedIn(cat)].filter((ref) => !mirrorNames.has(ref) && !bucket.has(ref))
    : [];

  const sync = async () => {
    setBusy("Téléversement…");
    setError(null);
    const { uploaded, error: message } = await syncMirrorToBucket(client, (n, total) =>
      setBusy(`Téléversement ${n}/${total}…`),
    );
    setBusy(null);
    if (message) setError(message);
    else setDone(uploaded === 0 ? "Le bucket était déjà à jour." : `${uploaded} icône(s) téléversée(s).`);
    await inspect();
  };

  const findOrphans = async () => {
    setBusy("Recherche…");
    setError(null);
    const { orphans: found, error: message } = await fetchOrphanIcons(client, GRACE_DAYS);
    setBusy(null);
    if (message) {
      setError(message);
      return;
    }
    if (!found?.length) {
      setDone("Aucune icône orpheline.");
      return;
    }
    setOrphans(found);
  };

  const purge = async () => {
    if (!orphans) return;
    setBusy("Suppression…");
    const message = await removeIcons(client, orphans.map((o) => o.name));
    setBusy(null);
    setOrphans(null);
    if (message) setError(message);
    else setDone(`${orphans.length} icône(s) supprimée(s).`);
    await inspect();
  };

  return (
    <Section
      title="Icônes"
      icon="image"
      note="Les portraits sont stockés hors du catalogue, qui n'en garde que la référence."
      meta={
        <button onClick={() => setHelp(true)} className="adm-tab" title="Comment fonctionnent les icônes">
          Aide
        </button>
      }
    >
      <div className="flex flex-col gap-3 text-sm">
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          <span>
            Miroir du dépôt : <strong>{mirrored}</strong>
          </span>
          <span>
            Bucket : <strong>{loading ? "…" : (bucket?.size ?? "?")}</strong>
          </span>
          {missing != null && missing > 0 && (
            <span className="adm-accent">{missing} absente(s) du bucket</span>
          )}
        </div>

        <p className="adm-faint text-xs">
          Le miroir est précaché avec l'app : c'est lui qui fait tenir les portraits hors-ligne. Le bucket sert
          les icônes créées depuis l'admin déployé, plus récentes que le dernier <code>catalog.json</code>{" "}
          committé. Téléverser met le second au niveau du premier.
        </p>

        {unresolvable.length > 0 && (
          <p className="ui-warn">
            {unresolvable.length} référence(s) du catalogue courant ne sont ni dans le dépôt ni dans le bucket :
            ces portraits ne s'afficheront nulle part. Téléverse avant de publier.
          </p>
        )}

        {error && (
          <p className="ui-error" role="alert">
            {error}
          </p>
        )}
        {done && <p className="adm-faint text-xs">{done}</p>}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="primary" onClick={sync} disabled={busy != null || !bucket}>
            {busy?.startsWith("Téléversement") ? busy : "Synchroniser le bucket"}
          </Button>
          <Button size="sm" onClick={findOrphans} disabled={busy != null || !bucket}>
            Chercher les orphelines
          </Button>
          <Button size="sm" onClick={inspect} disabled={busy != null || loading}>
            Rafraîchir
          </Button>
        </div>
      </div>

      <Dialog
        open={orphans != null}
        onOpenChange={(open) => !open && setOrphans(null)}
        size="sm"
        title="Purger les icônes orphelines"
      >
        <div className="flex flex-col gap-3 text-sm">
          <p>
            {orphans?.length} icône(s) du bucket ne sont citées par aucune des versions conservées, et ont plus
            de {GRACE_DAYS} jours. Les supprimer libère leur stockage.
          </p>
          <p className="adm-faint text-xs">
            Le délai de {GRACE_DAYS} jours protège une icône enregistrée mais pas encore publiée : elle est
            légitimement sans référence tant que la publication n'a pas eu lieu.
          </p>
          <ul className="adm-scroll max-h-40 overflow-y-auto text-xs">
            {orphans?.map((o) => (
              <li key={o.name} className="flex justify-between gap-3 py-0.5">
                <code>{o.name}</code>
                <span className="adm-faint">{ko(o.size)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-end gap-2">
            <Button size="sm" onClick={() => setOrphans(null)} disabled={busy != null}>
              Annuler
            </Button>
            <Button size="sm" variant="primary" onClick={purge} disabled={busy != null}>
              {busy ?? "Supprimer"}
            </Button>
          </div>
        </div>
      </Dialog>

      <IconsHelp open={help} onOpenChange={setHelp} />
    </Section>
  );
}
