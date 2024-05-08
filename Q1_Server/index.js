const express = require("express");
const axios = require("axios");
const NodeCache = require("node-cache");

const app = express();
const cache = new NodeCache({ stdTTL: 300 }); // cache it for 5 minutes

const ACCESS_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiZXhwIjoxNzE1MTUxMTQzLCJpYXQiOjE3MTUxNTA4NDMsImlzcyI6IkFmZm9yZG1lZCIsImp0aSI6ImFiOWNiN2I4LTljMTctNGVjMi1iNTU4LWI2Nzg2ZTE5NWMyNSIsInN1YiI6InByaW5jZWFrMjI0ODZAZ21haWwuY29tIn0sImNvbXBhbnlOYW1lIjoiIEtJSVQiLCJjbGllbnRJRCI6ImFiOWNiN2I4LTljMTctNGVjMi1iNTU4LWI2Nzg2ZTE5NWMyNSIsImNsaWVudFNlY3JldCI6InBYdnlmdUVESWNYSUxmTlEiLCJvd25lck5hbWUiOiJBZGl0eWEgS3VtYXIgUHJhamFwYXRpIiwib3duZXJFbWFpbCI6InByaW5jZWFrMjI0ODZAZ21haWwuY29tIiwicm9sbE5vIjoiMjEwNjE3NyJ9.1ClUiqtPYjY7HsHuNLq4_rHDzK7qt247PN01auDqiT0";
const API_BASE_URL = "http://20.244.56.144/test";

app.get("/categories/products", async (req, res) => {
  try {
    const {
      category,
      company,
      minRating,
      maxRating,
      minPrice,
      maxPrice,
      availableOnly,
      sortBy,
      sortOrder,
      page,
      n,
    } = req.query;
    const cacheKey = `products_${category}_${company}_${minRating}_${maxRating}_${minPrice}_${maxPrice}_${availableOnly}_${sortBy}_${sortOrder}_${page}_${n}`;
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    const companies = company ? [company] : ["AMZ", "FLP", "SNP", "MYN", "AZO"];
    const requests = companies.map((company) =>
      axios.get(
        `${API_BASE_URL}/companies/${company}/categories/${
          category || ""
        }/products`,
        {
          params: {
            top: n,
            minPrice: minPrice || 1,
            maxPrice: maxPrice || 1000000,
          },
          headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
        }
      )
    );

    const responses = await Promise.all(requests);
    let products = responses.flatMap((response) => response.data);

    if (minRating) {
      products = products.filter(
        (product) => product.rating >= parseFloat(minRating)
      );
    }
    if (maxRating) {
      products = products.filter(
        (product) => product.rating <= parseFloat(maxRating)
      );
    }
    if (availableOnly) {
      products = products.filter((product) => product.availability === "yes");
    }

    products = products.map((product, index) => ({
      ...product,
      id: `${product.productName}_${index}`,
      company:
        companies[
          responses.findIndex((response) => response.data.includes(product))
        ],
      category: category || "",
    }));

    if (sortBy === "price") {
      products.sort((a, b) =>
        sortOrder === "asc" ? a.price - b.price : b.price - a.price
      );
    } else if (sortBy === "rating") {
      products.sort((a, b) =>
        sortOrder === "asc" ? a.rating - b.rating : b.rating - a.rating
      );
    } else if (sortBy === "discount") {
      products.sort((a, b) =>
        sortOrder === "asc" ? a.discount - b.discount : b.discount - a.discount
      );
    }

    const startIndex = (page - 1) * n;
    const endIndex = page * n;
    const paginatedProducts = products.slice(startIndex, endIndex);

    cache.set(cacheKey, paginatedProducts);

    res.json(paginatedProducts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred" });
  }
});

app.get("/categories/products/:productId", async (req, res) => {
  try {
    const { productId } = req.params;
    const cacheKey = `product_${productId}`;
    const cachedProduct = cache.get(cacheKey);

    if (cachedProduct) {
      return res.json(cachedProduct);
    }

    const companies = ["AMZ", "FLP", "SNP", "MYN", "AZO"];
    const requests = companies.map((company) =>
      axios.get(`${API_BASE_URL}/companies/${company}/categories//products`, {
        params: { top: 1000 },
        headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
      })
    );

    const responses = await Promise.all(requests);
    const products = responses.flatMap((response) => response.data);

    const product = products.find(
      (p) => `${p.productName}_${products.indexOf(p)}` === productId
    );

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const productWithDetails = {
      ...product,
      company:
        companies[
          responses.findIndex((response) => response.data.includes(product))
        ],
      category: "",
    };

    cache.set(cacheKey, productWithDetails);

    res.json(productWithDetails);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
