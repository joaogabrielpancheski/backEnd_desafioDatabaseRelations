import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer not found');
    }

    const savedProducts = await this.productsRepository.findAllById(
      products.map(product => ({ id: product.id })),
    );

    if (!savedProducts || savedProducts.length < products.length) {
      throw new AppError('Products not found');
    }

    savedProducts.forEach(savedProduct => {
      const orderQuantity =
        products.find(product => product.id === savedProduct.id)?.quantity || 0;
      if (savedProduct.quantity - orderQuantity < 0) {
        throw new AppError('Product out of stock');
      }
    });

    const updatedProducts = await this.productsRepository.updateQuantity(
      products,
    );

    if (!updatedProducts) {
      throw new AppError('Product out of stock or not found.');
    }

    const createProducts: any[] = [];

    updatedProducts.map(updatedProduct => {
      const createProduct = {
        product_id: updatedProduct.id,
        price: updatedProduct.price,
        quantity: updatedProduct.quantity,
      };

      createProducts.push(createProduct);

      return null;
    });

    const order = await this.ordersRepository.create({
      customer,
      products: products.map(product => ({
        product_id: product.id,
        price:
          savedProducts.find(savedProduct => savedProduct.id === product.id)
            ?.price || 0,
        quantity: product.quantity,
      })),
    });

    return order;
  }
}

export default CreateOrderService;
