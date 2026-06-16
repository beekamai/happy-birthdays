import { OG_WIDTH, OG_HEIGHT } from "../config/constants";

/*
 * Satori node builder for the Open Graph card. Returns a plain object tree
 * (NOT JSX) — satori consumes { type, props: { style, children } } nodes.
 *
 * Hard rules for this tree:
 *   - Every container that has children MUST set display:"flex".
 *   - Emoji are rendered as <img> data-URIs, never as raw emoji characters.
 *   - All colours are literals; satori has no CSS variable support.
 *
 * Palette: the cozy "Cozy Ramen" look — cream background, cocoa title text,
 * a soft warm subtitle, and an accent-coloured ring around the avatar.
 */

const CREAM = "#FFF7ED";
const COCOA = "#5A3E2B";
const SOFT = "#8A6F5C";
const CORAL_GLOW = "rgba(255,138,101,0.35)";
const BLUE_GLOW = "rgba(126,194,232,0.30)";

interface OgTemplateArgs {
    displayName: string;
    username: string;
    dateText: string;
    avatarDataUri: string;
    giftEmojiDataUri: string | null;
    accent: string;
}

interface ProfileOgArgs {
    displayName: string;
    username: string;
    bio: string;
    avatarDataUri: string;
    accent: string;
}

/** Build the satori node tree for a friend's OG card. */
export function buildOgNode(args: OgTemplateArgs): object {
    const { displayName, username, dateText, avatarDataUri, giftEmojiDataUri, accent } = args;

    /* Subtitle row: date text + optional gift emoji image. */
    const subtitleChildren: object[] = [
        {
            type: "div",
            props: {
                style: { display: "flex" },
                children: dateText,
            },
        },
    ];
    if (giftEmojiDataUri) {
        subtitleChildren.push({
            type: "img",
            props: {
                src: giftEmojiDataUri,
                width: 56,
                height: 56,
                style: { marginLeft: "18px" },
            },
        });
    }

    return {
        type: "div",
        props: {
            style: {
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                width: `${OG_WIDTH}px`,
                height: `${OG_HEIGHT}px`,
                backgroundColor: CREAM,
                /* Two soft radial glows: coral top-left, blue bottom-right. */
                backgroundImage: `radial-gradient(circle at 18% 20%, ${CORAL_GLOW} 0%, rgba(255,247,237,0) 45%), radial-gradient(circle at 82% 85%, ${BLUE_GLOW} 0%, rgba(255,247,237,0) 50%)`,
                fontFamily: "Nunito",
                padding: "56px",
            },
            children: [
                /* Avatar with accent ring. */
                {
                    type: "img",
                    props: {
                        src: avatarDataUri,
                        width: 240,
                        height: 240,
                        style: {
                            borderRadius: 9999,
                            objectFit: "cover",
                            border: `10px solid ${accent}`,
                        },
                    },
                },
                /* Title. */
                {
                    type: "div",
                    props: {
                        style: {
                            display: "flex",
                            marginTop: "40px",
                            fontFamily: "Comfortaa",
                            fontWeight: 700,
                            fontSize: "64px",
                            color: COCOA,
                            textAlign: "center",
                            lineHeight: 1.15,
                            maxWidth: "1040px",
                        },
                        children: `С днём рождения, ${displayName}!`,
                    },
                },
                /* Subtitle row: date + gift emoji. */
                {
                    type: "div",
                    props: {
                        style: {
                            display: "flex",
                            alignItems: "center",
                            marginTop: "24px",
                            fontFamily: "Nunito",
                            fontWeight: 400,
                            fontSize: "36px",
                            color: SOFT,
                        },
                        children: subtitleChildren,
                    },
                },
                /* Username footer. */
                {
                    type: "div",
                    props: {
                        style: {
                            display: "flex",
                            marginTop: "18px",
                            fontFamily: "Nunito",
                            fontWeight: 700,
                            fontSize: "28px",
                            color: accent,
                        },
                        children: username,
                    },
                },
            ],
        },
    };
}

/** Build the satori node tree for a friend's personal profile OG card. */
export function buildProfileOgNode(args: ProfileOgArgs): object {
    const { displayName, username, bio, avatarDataUri, accent } = args;

    const children: object[] = [
        /* Avatar with accent ring. */
        {
            type: "img",
            props: {
                src: avatarDataUri,
                width: 240,
                height: 240,
                style: {
                    borderRadius: 9999,
                    objectFit: "cover",
                    border: `10px solid ${accent}`,
                },
            },
        },
        /* Display name. */
        {
            type: "div",
            props: {
                style: {
                    display: "flex",
                    marginTop: "40px",
                    fontFamily: "Comfortaa",
                    fontWeight: 700,
                    fontSize: "68px",
                    color: COCOA,
                    textAlign: "center",
                    lineHeight: 1.1,
                    maxWidth: "1040px",
                },
                children: displayName,
            },
        },
        /* Username. */
        {
            type: "div",
            props: {
                style: {
                    display: "flex",
                    marginTop: "16px",
                    fontFamily: "Nunito",
                    fontWeight: 700,
                    fontSize: "30px",
                    color: accent,
                },
                children: username,
            },
        },
    ];

    /* Optional bio snippet. */
    if (bio) {
        children.push({
            type: "div",
            props: {
                style: {
                    display: "flex",
                    marginTop: "26px",
                    fontFamily: "Nunito",
                    fontWeight: 400,
                    fontSize: "32px",
                    color: SOFT,
                    textAlign: "center",
                    lineHeight: 1.3,
                    maxWidth: "900px",
                },
                children: bio,
            },
        });
    }

    return {
        type: "div",
        props: {
            style: {
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                width: `${OG_WIDTH}px`,
                height: `${OG_HEIGHT}px`,
                backgroundColor: CREAM,
                backgroundImage: `radial-gradient(circle at 18% 20%, ${CORAL_GLOW} 0%, rgba(255,247,237,0) 45%), radial-gradient(circle at 82% 85%, ${BLUE_GLOW} 0%, rgba(255,247,237,0) 50%)`,
                fontFamily: "Nunito",
                padding: "56px",
            },
            children,
        },
    };
}
