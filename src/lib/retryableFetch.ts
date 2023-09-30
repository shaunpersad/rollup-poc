const retryableFetch: typeof fetch = async (...args): Promise<Response> => {
  const response = await fetch(...args);
  if (!response.ok) {
    await new Promise((resolve) => {
      setTimeout(resolve, Math.random() * 1000);
    });
    return retryableFetch(...args);
  }
  return response;
};

export default retryableFetch;
