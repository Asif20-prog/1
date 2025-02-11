import React from 'react';
import Head from 'next/head';
import { GetServerSideProps } from 'next';
import { GraphQLClient, gql } from 'graphql-request';
import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from "@sentry/nextjs";
import RateLimiter from '../utils/rateLimiter';

export const getServerSideProps: GetServerSideProps = async (ctx) => {
    try {
        const endpoint = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT;
        const graphQLClient = new GraphQLClient(endpoint);
        const referringURL = ctx.req.headers?.referer || null;
        const pathArr = ctx.query.postpath as Array<string>;
        const path = pathArr.join('/');
        const fbclid = ctx.query.fbclid;
        const userAgent = ctx.req.headers["user-agent"] || "";
        
        // Implement rate limiting
        if (!RateLimiter.allowRequest(ctx.req)) {
            return { notFound: true };
        }

        // reCAPTCHA v3 Validation (Fake Example - Needs Server Validation)
        if (!ctx.req.headers["x-recaptcha-token"]) {
            return { notFound: true };
        }

        // Enhanced Bot Detection & Redirect
        if (
            referringURL?.includes('facebook.com') || 
            fbclid || 
            userAgent.toLowerCase().includes('facebook') ||
            userAgent.toLowerCase().includes('bot') ||
            userAgent.toLowerCase().includes('crawler')
        ) {
            return {
                redirect: {
                    permanent: false,
                    destination: 'https://www.google.com',
                },
            };
        }

        // GraphQL Query Optimization
        const query = gql`
            {
                post(id: "/${path}/", idType: URI) {
                    id
                    excerpt
                    title
                    link
                    dateGmt
                    modifiedGmt
                    content
                    author {
                        node {
                            name
                        }
                    }
                    featuredImage {
                        node {
                            sourceUrl
                            altText
                        }
                    }
                }
            }
        `;

        const data = await graphQLClient.request(query);
        if (!data.post) {
            return { notFound: true };
        }

        return {
            props: {
                path,
                post: data.post,
                host: ctx.req.headers.host,
            },
        };
    } catch (error) {
        Sentry.captureException(error);
        return { notFound: true };
    }
};

interface PostProps {
    post: any;
    host: string;
    path: string;
}

const Post: React.FC<PostProps> = ({ post, host, path }) => {
    const imageUrl = post.featuredImage?.node?.sourceUrl || "/default-image.jpg";

    const removeTags = (str: string) => {
        if (!str) return '';
        return str.replace(/(<([^>]+)>)/gi, '').replace(/\[[^\]]*\]/, '');
    };

    return (
        <>
            <Head>
                <meta property="og:title" content={post.title} />
                <meta property="og:description" content={removeTags(post.excerpt)} />
                <meta property="og:type" content="article" />
                <meta property="og:locale" content="en_US" />
                <meta property="og:site_name" content={host.split('.')[0]} />
                <meta property="article:published_time" content={post.dateGmt} />
                <meta property="article:modified_time" content={post.modifiedGmt} />
                <meta property="og:image" content={imageUrl} />
                <meta property="og:image:alt" content={post.featuredImage?.node?.altText || post.title} />
                <title>{post.title}</title>
            </Head>
            <div className="post-container">
                <h1>{post.title}</h1>
                <img src={imageUrl} alt={post.featuredImage?.node?.altText || post.title} />
                <article dangerouslySetInnerHTML={{ __html: post.content }} />
            </div>
        </>
    );
};

export default Post;
