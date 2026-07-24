/**
 * Traduction des erreurs Supabase Auth (messages anglais, non localisés côté SDK)
 * en messages utilisables tels quels dans l'UI.
 */
const TRANSLATIONS: ReadonlyArray<[RegExp, string]> = [
  [/invalid login credentials/i, "E-mail ou mot de passe incorrect."],
  [/email not confirmed/i, "Adresse e-mail pas encore confirmée : vérifie ta boîte de réception."],
  [/user already registered|already been registered/i, "Un compte existe déjà avec cette adresse."],
  [/password should be at least (\d+)/i, "Mot de passe trop court : $1 caractères minimum."],
  [/unable to validate email address|invalid email/i, "Adresse e-mail invalide."],
  [/email rate limit exceeded|over_email_send_rate_limit/i, "Trop de tentatives : réessaie dans quelques minutes."],
  [/provider is not enabled|unsupported provider/i, "Ce mode de connexion n'est pas activé côté serveur."],
  [/failed to fetch|network/i, "Serveur injoignable : vérifie ta connexion."],
];

/**
 * Message d'erreur prêt à afficher (renvoie `null` s'il n'y a pas d'erreur).
 * Sans traduction connue, on retombe sur le message brut plutôt que sur un « erreur
 * inconnue » : mieux vaut un message en anglais qu'aucune information exploitable.
 */
export function authErrorMessage(error: { message: string } | null | undefined): string | null {
  if (!error) return null;
  for (const [pattern, message] of TRANSLATIONS) {
    const match = error.message.match(pattern);
    if (match) return message.replace("$1", match[1] ?? "");
  }
  return error.message;
}
