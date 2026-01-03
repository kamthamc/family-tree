import type { Person } from '../api';

export function generateVCard(person: Person): string {
    const n = [person.lastName || '', person.firstName || '', person.middleName || '', person.attributes?.title || '', person.attributes?.suffix || ''].join(';');
    const fn = [person.firstName, person.middleName, person.lastName].filter(Boolean).join(' ');

    const parts = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `N:${n}`,
        `FN:${fn}`,
    ];

    if (person.nickname) parts.push(`NICKNAME:${person.nickname}`);
    if (person.gender) parts.push(`X-GENDER:${person.gender}`);
    if (person.birthDate) parts.push(`BDAY:${person.birthDate.replace(/-/g, '')}`);
    if (person.phone) parts.push(`TEL;TYPE=CELL:${person.phone}`);
    if (person.address) parts.push(`ADR;TYPE=HOME:;;${person.address.replace(/;/g, ',')};;;;`);

    // Attributes
    if (person.attributes?.occupation) parts.push(`TITLE:${person.attributes.occupation}`);
    if (person.attributes?.education) parts.push(`NOTE:Education: ${person.attributes.education}`);
    if (person.notes) parts.push(`NOTE:${person.notes.replace(/\n/g, '\\n')}`);

    // Photo? (Too large to inline usually, but link is possible if hosted. Here it's base64 often or local)
    // If base64, we can strip prefix and add.
    if (person.profileImage && person.profileImage.startsWith('data:image')) {
        const type = person.profileImage.split(';')[0].split(':')[1].toUpperCase().replace('IMAGE/', '');
        const data = person.profileImage.split(',')[1];
        parts.push(`PHOTO;ENCODING=b;TYPE=${type}:${data}`);
    }

    parts.push('END:VCARD');
    return parts.join('\n');
}

export function downloadVCard(person: Person) {
    const vcard = generateVCard(person);
    const blob = new Blob([vcard], { type: 'text/vcard' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    const name = [person.firstName, person.lastName].filter(Boolean).join('_') || 'contact';
    link.download = `${name}.vcf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
