
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import SalesToolkit from '../components/SalesToolkit';

export default function Home({ authenticated }) {
    const router = useRouter();
    const { shop } = router.query;

    useEffect(() => {
        if (shop && !authenticated) {
            router.push(`/api/auth/start?shop=${shop}`);
        }
    }, [shop, authenticated, router]);

    if (!authenticated && shop) {
        return <div>Redirecting to authentication...</div>;
    }
    
    if (!shop && !authenticated) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <div className="text-center p-8 bg-white shadow-lg rounded-lg">
                <h1 className="text-2xl font-bold text-gray-800">Welcome to the Sales Toolkit</h1>
                <p className="mt-2 text-gray-600">This app must be launched from the Shopify admin panel.</p>
            </div>
        </div>
      )
    }

    return <SalesToolkit />;
}

export async function getServerSideProps(context) {
    const { req } = context;
    const authenticated = req.cookies.hasOwnProperty('shopify_app_session');

    return {
        props: {
            authenticated,
        },
    };
}
